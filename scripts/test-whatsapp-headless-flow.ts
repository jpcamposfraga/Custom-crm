/**
 * End-to-End Verification of WhatsApp Headless & Auto-Send Flow
 * 
 * Verifies:
 * 1. Default disabled state (autoSendEnabled: false).
 * 2. QR code initiation and status transitions.
 * 3. Settings persistence and eligibility gating.
 * 4. Headless message dispatch without opening windows.
 * 5. Scheduler worker auto-send integration.
 * 6. Graceful fallback to OS URL launcher when disabled or disconnected.
 * 7. Session disconnection and cleanup.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { WhatsAppAutomationDriver } from '../crm/src/lib/whatsapp-headless';

const TEST_DB_PATH = path.resolve(process.cwd(), 'test-headless-flow.db');
process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;

async function runHeadlessVerification() {
  console.log('🚀 Starting WhatsApp Headless & Auto-Send E2E Verification...\n');

  try {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    const journal = `${TEST_DB_PATH}-journal`;
    if (fs.existsSync(journal)) fs.unlinkSync(journal);
  } catch (e) {}

  const { initDatabase, getDatabase } = await import('../crm/src/db');
  const { scheduledMessages, leads, settings } = await import('../crm/src/db/schema');
  const { eq } = await import('drizzle-orm');
  const {
    getWhatsAppSessionStatus,
    startWhatsAppSession,
    logoutWhatsAppSession,
    sendHeadlessMessage,
    isAutoSendEligible,
    setAutomationDriver,
    resetAutomationDriver,
  } = await import('../crm/src/lib/whatsapp-headless');
  const {
    checkAndTriggerDueMessages,
    setUrlLauncher,
    resetUrlLauncher,
  } = await import('../crm/src/lib/scheduler-worker');

  await initDatabase();
  const { db, client } = getDatabase();

  let mockDriverStatus: 'disconnected' | 'waiting_qr' | 'connected' = 'disconnected';
  let mockDriverQr: string | null = null;
  const headlessDispatched: Array<{ phone: string; message: string }> = [];
  const osDispatchedUrls: string[] = [];

  const mockDriver: WhatsAppAutomationDriver = {
    getStatus: async () => ({ status: mockDriverStatus, qrCode: mockDriverQr }),
    start: async () => {
      mockDriverStatus = 'waiting_qr';
      mockDriverQr = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
      return { status: mockDriverStatus, qrCode: mockDriverQr };
    },
    logout: async () => {
      mockDriverStatus = 'disconnected';
      mockDriverQr = null;
    },
    send: async (phone: string, message: string) => {
      if (mockDriverStatus !== 'connected') {
        return { success: false, error: 'WhatsApp desconectado' };
      }
      headlessDispatched.push({ phone, message });
      return { success: true };
    },
  };

  setAutomationDriver(mockDriver);
  setUrlLauncher(async (url: string) => {
    osDispatchedUrls.push(url);
  });

  try {
    // 1. Initial State Check
    console.log('📌 [Step 1] Verifying default disabled & disconnected state...');
    const initialStatus = await getWhatsAppSessionStatus();
    console.log(`   Status: ${initialStatus.status}, autoSendEnabled: ${initialStatus.autoSendEnabled}`);
    if (initialStatus.autoSendEnabled !== false || initialStatus.status !== 'disconnected') {
      throw new Error('Default state must be disconnected with autoSendEnabled: false');
    }
    const initialEligible = await isAutoSendEligible();
    if (initialEligible !== false) {
      throw new Error('isAutoSendEligible must return false when disconnected');
    }
    console.log('   ✅ Initial state is properly secured.\n');

    // 2. Start Session & QR Code Generation
    console.log('📌 [Step 2] Requesting WhatsApp connection & QR Code generation...');
    const startResult = await startWhatsAppSession();
    console.log(`   Status: ${startResult.status}, QR Code length: ${startResult.qrCode?.length || 0}`);
    if (startResult.status !== 'waiting_qr' || !startResult.qrCode) {
      throw new Error('Expected waiting_qr with QR Code data');
    }
    console.log('   ✅ QR Code successfully provided for Settings page.\n');

    // 3. User Enables Auto-Send in Settings & Scans QR
    console.log('📌 [Step 3] Simulating QR scan and user activating auto_send_whatsapp...');
    await db
      .insert(settings)
      .values({ key: 'auto_send_whatsapp', value: 'true', updated_at: new Date().toISOString() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: 'true' },
      });

    mockDriverStatus = 'connected';
    mockDriverQr = null;

    const connectedStatus = await getWhatsAppSessionStatus();
    console.log(`   Status: ${connectedStatus.status}, autoSendEnabled: ${connectedStatus.autoSendEnabled}`);
    if (!connectedStatus.autoSendEnabled || connectedStatus.status !== 'connected') {
      throw new Error('Expected connected and autoSendEnabled: true');
    }
    if (!(await isAutoSendEligible())) {
      throw new Error('isAutoSendEligible must return true when connected and enabled');
    }
    console.log('   ✅ Auto-send is now eligible and ready.\n');

    // 4. Test Headless Send Direct
    console.log('📌 [Step 4] Testing direct headless message dispatch...');
    const directResult = await sendHeadlessMessage('19988776655', 'Mensagem direta teste headless');
    if (!directResult.success || headlessDispatched.length !== 1) {
      throw new Error('Direct headless dispatch failed');
    }
    console.log('   ✅ Message dispatched headlessly without opening any OS windows.\n');

    // 5. Test Scheduler Worker with Headless Auto-Send
    console.log('📌 [Step 5] Testing Scheduler Worker with Headless auto-send enabled...');
    const leadId1 = crypto.randomUUID();
    const msgId1 = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    await db.insert(leads).values({
      id: leadId1,
      name: 'Dr. Roberto Clínicas',
      phone: '(19) 99123-4567',
      normalized_phone: '19991234567',
      has_website: 1,
      nicho: 'Médico',
      created_at: nowIso,
      updated_at: nowIso,
    });

    await db.insert(scheduledMessages).values({
      id: msgId1,
      lead_id: leadId1,
      message: 'Olá Dr. Roberto, proposta comercial!',
      scheduled_for: new Date(Date.now() - 1000).toISOString(),
      status: 'pendente',
      platform: 'web',
      created_at: nowIso,
    });

    const triggerResult = await checkAndTriggerDueMessages({ delayBetweenMs: 0 });
    console.log(`   Scheduler processed count: ${triggerResult.processedCount}`);
    if (triggerResult.processedCount !== 1) {
      throw new Error(`Expected 1 message processed, got ${triggerResult.processedCount}`);
    }

    // Must be in headlessDispatched, NOT in osDispatchedUrls
    if (headlessDispatched.length !== 2) {
      throw new Error(`Expected 2 total headless messages, got ${headlessDispatched.length}`);
    }
    if (osDispatchedUrls.length !== 0) {
      throw new Error(`OS launcher should not have been called! Found ${osDispatchedUrls.length}`);
    }

    const [savedMsg] = await db.select().from(scheduledMessages).where(eq(scheduledMessages.id, msgId1));
    if (savedMsg.status !== 'enviado') {
      throw new Error(`Message status in DB should be 'enviado', got: ${savedMsg.status}`);
    }
    console.log('   ✅ Scheduled message successfully sent via headless worker.\n');

    // 6. Test Fallback when Auto-Send is disabled
    console.log('📌 [Step 6] Testing fallback to OS launcher when auto-send is turned OFF...');
    await db
      .update(settings)
      .set({ value: 'false' })
      .where(eq(settings.key, 'auto_send_whatsapp'));

    const leadId2 = crypto.randomUUID();
    const msgId2 = crypto.randomUUID();

    await db.insert(leads).values({
      id: leadId2,
      name: 'Dra. Vanessa',
      phone: '19987650000',
      normalized_phone: '19987650000',
      has_website: 0,
      nicho: 'Estética',
      created_at: nowIso,
      updated_at: nowIso,
    });

    await db.insert(scheduledMessages).values({
      id: msgId2,
      lead_id: leadId2,
      message: 'Olá Vanessa, confirmando agendamento!',
      scheduled_for: new Date(Date.now() - 1000).toISOString(),
      status: 'pendente',
      platform: 'web',
      created_at: nowIso,
    });

    await checkAndTriggerDueMessages({ delayBetweenMs: 0 });

    if (osDispatchedUrls.length !== 1) {
      throw new Error(`OS launcher should have been invoked as fallback! Found ${osDispatchedUrls.length}`);
    }
    console.log(`   Fallback URL launched: ${osDispatchedUrls[0].substring(0, 60)}...`);
    console.log('   ✅ Fallback to standard WhatsApp Web URL works flawlessly.\n');

    // 7. Test Disconnect
    console.log('📌 [Step 7] Testing session logout...');
    await logoutWhatsAppSession();
    const afterLogoutStatus = await getWhatsAppSessionStatus();
    if (afterLogoutStatus.status !== 'disconnected') {
      throw new Error('Expected disconnected status after logout');
    }
    console.log('   ✅ WhatsApp session disconnected cleanly.\n');

    console.log('🎉 ALL WHATSAPP HEADLESS & AUTO-SEND E2E TESTS PASSED WITH 100% SUCCESS!');
  } finally {
    resetAutomationDriver();
    resetUrlLauncher();
    try {
      client.close();
      if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
      const journal = `${TEST_DB_PATH}-journal`;
      if (fs.existsSync(journal)) fs.unlinkSync(journal);
    } catch (e) {}
  }
}

runHeadlessVerification().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
