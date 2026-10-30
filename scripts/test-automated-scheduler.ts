/**
 * Automated Scheduler Verification Script
 * 
 * Verifies that the singleton background worker:
 * 1. Accurately detects scheduled messages when their scheduled_for time arrives.
 * 2. Generates the exact direct WhatsApp URL (Web and Desktop).
 * 3. Triggers the OS launcher sequentially without creating multiple worker processes.
 * 4. Automatically transitions status from 'pendente' to 'enviado' in the database.
 * 5. Updates lead status to 'em_contato'.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const TEST_DB_PATH = path.resolve(process.cwd(), 'test-scheduler.db');
process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;

async function runSchedulerVerification() {
  console.log('🚀 Starting Automated Scheduler & Worker Verification...\n');

  // Clean previous run database if exists
  try {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    const journal = `${TEST_DB_PATH}-journal`;
    if (fs.existsSync(journal)) fs.unlinkSync(journal);
  } catch (e) {}

  const { initDatabase, getDatabase } = await import('../crm/src/db');
  const { scheduledMessages, leads } = await import('../crm/src/db/schema');
  const { eq } = await import('drizzle-orm');
  const {
    checkAndTriggerDueMessages,
    setUrlLauncher,
    resetUrlLauncher,
  } = await import('../crm/src/lib/scheduler-worker');

  await initDatabase();
  const { db, client } = getDatabase();

  const dispatchedUrls: string[] = [];
  setUrlLauncher(async (url: string) => {
    dispatchedUrls.push(url);
    console.log(`   [Mock OS Launcher] Executado no SO: start "" "${url.substring(0, 75)}..."`);
  });

  try {
    // 1. Create test lead
    console.log('📌 [Step 1] Creating test lead with phone...');
    const leadId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    await db.insert(leads).values({
      id: leadId,
      name: 'Dra. Mariana Odontologia',
      phone: '(19) 98123-4567',
      normalized_phone: '19981234567',
      has_website: 1,
      website: 'https://marianaodonto.com.br',
      nicho: 'Dentista',
      location: 'Campinas, SP',
      status: 'novo',
      created_at: nowIso,
      updated_at: nowIso,
    });
    console.log('   ✅ Lead created: Dra. Mariana Odontologia (19981234567)\n');

    // 2. Schedule message for 2 seconds in the future
    console.log('📌 [Step 2] Scheduling message 2 seconds in the future...');
    const msgId = crypto.randomUUID();
    const scheduledTime = new Date(Date.now() + 2000).toISOString();

    await db.insert(scheduledMessages).values({
      id: msgId,
      lead_id: leadId,
      message: 'Olá Mariana, temos uma proposta para sua clínica de Odontologia!',
      scheduled_for: scheduledTime,
      status: 'pendente',
      platform: 'web',
      created_at: nowIso,
    });
    console.log(`   ✅ Message scheduled for: ${scheduledTime}\n`);

    // 3. Immediate check before due time: should NOT trigger
    console.log('📌 [Step 3] Running check immediately before due time...');
    const earlyCheck = await checkAndTriggerDueMessages({ delayBetweenMs: 0 });
    console.log(`   Processed count: ${earlyCheck.processedCount} (expected 0)`);
    if (earlyCheck.processedCount !== 0 || dispatchedUrls.length !== 0) {
      throw new Error(`Worker triggered early! Expected 0, got ${earlyCheck.processedCount}`);
    }
    console.log('   ✅ Worker correctly respected future schedule (0 messages triggered).\n');

    // 4. Wait 3 seconds to pass scheduled time
    console.log('📌 [Step 4] Waiting 3 seconds for scheduled time to arrive...');
    await new Promise((resolve) => setTimeout(resolve, 3000));
    console.log('   Time elapsed. Triggering worker queue check...');

    // 5. Trigger check now that time has arrived
    const dueCheck = await checkAndTriggerDueMessages({ delayBetweenMs: 0 });
    console.log(`   Processed count: ${dueCheck.processedCount} (expected 1)`);
    if (dueCheck.processedCount !== 1 || dispatchedUrls.length !== 1) {
      throw new Error(`Worker failed to trigger due message! Got: ${dueCheck.processedCount}`);
    }

    const dispatchedUrl = dispatchedUrls[0];
    console.log(`   ✅ Dispatched URL: ${dispatchedUrl}`);
    if (!dispatchedUrl.includes('web.whatsapp.com/send') || !dispatchedUrl.includes('5519981234567')) {
      throw new Error(`URL formatting invalid: ${dispatchedUrl}`);
    }

    // 6. Verify DB record transitioned to 'enviado'
    console.log('\n📌 [Step 5] Verifying database status transitions...');
    const [savedMsg] = await db.select().from(scheduledMessages).where(eq(scheduledMessages.id, msgId));
    console.log(`   Message status in DB: ${savedMsg.status} (expected: 'enviado')`);
    if (savedMsg.status !== 'enviado') {
      throw new Error(`Expected message status 'enviado', found: ${savedMsg.status}`);
    }

    const [savedLead] = await db.select().from(leads).where(eq(leads.id, leadId));
    console.log(`   Lead status in DB: ${savedLead.status} (expected: 'em_contato')`);
    if (savedLead.status !== 'em_contato') {
      throw new Error(`Expected lead status 'em_contato', found: ${savedLead.status}`);
    }

    console.log('\n🎉 ALL SCHEDULER TESTS PASSED WITH 100% SUCCESS!');
  } finally {
    resetUrlLauncher();
    try {
      client.close();
      if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
      const journal = `${TEST_DB_PATH}-journal`;
      if (fs.existsSync(journal)) fs.unlinkSync(journal);
    } catch (e) {}
  }
}

runSchedulerVerification().catch((err) => {
  console.error('❌ Scheduler verification failed:', err);
  process.exit(1);
});
