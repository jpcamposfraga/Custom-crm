import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, initDatabase } from '../src/db';
import { settings } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import {
  getWhatsAppSessionStatus,
  startWhatsAppSession,
  logoutWhatsAppSession,
  sendHeadlessMessage,
  isAutoSendEligible,
  setAutomationDriver,
  resetAutomationDriver,
  type WhatsAppAutomationDriver,
} from '../src/lib/whatsapp-headless';

describe('WhatsApp Headless Automation (Playwright)', () => {
  let mockStatus: 'disconnected' | 'waiting_qr' | 'connected' = 'disconnected';
  let mockQrCode: string | null = null;
  const sentMessages: Array<{ phone: string; message: string }> = [];

  const mockDriver: WhatsAppAutomationDriver = {
    getStatus: async () => ({ status: mockStatus, qrCode: mockQrCode }),
    start: async () => {
      mockStatus = 'waiting_qr';
      mockQrCode = 'data:image/png;base64,mockqr123';
      return { status: mockStatus, qrCode: mockQrCode };
    },
    logout: async () => {
      mockStatus = 'disconnected';
      mockQrCode = null;
    },
    send: async (phone: string, message: string) => {
      if (mockStatus !== 'connected') {
        return { success: false, error: 'WhatsApp não está conectado' };
      }
      if (phone.includes('000000000')) {
        return { success: false, error: 'Número de telefone inválido no WhatsApp' };
      }
      sentMessages.push({ phone, message });
      return { success: true };
    },
  };

  beforeEach(async () => {
    mockStatus = 'disconnected';
    mockQrCode = null;
    sentMessages.length = 0;
    setAutomationDriver(mockDriver);
    await initDatabase();
  });

  afterEach(async () => {
    resetAutomationDriver();
  });

  it('reports initial disconnected status and auto_send_whatsapp = false by default', async () => {
    const { db } = getDatabase();
    // Ensure setting is not true
    await db.delete(settings).where(eq(settings.key, 'auto_send_whatsapp'));

    const status = await getWhatsAppSessionStatus();
    expect(status.status).toBe('disconnected');
    expect(status.autoSendEnabled).toBe(false);

    const isEligible = await isAutoSendEligible();
    expect(isEligible).toBe(false);
  });

  it('starts session and transitions to waiting_qr with QR Code', async () => {
    const result = await startWhatsAppSession();
    expect(result.status).toBe('waiting_qr');
    expect(result.qrCode).toContain('data:image/png;base64');

    const status = await getWhatsAppSessionStatus();
    expect(status.status).toBe('waiting_qr');
    expect(status.qrCode).toBe(result.qrCode);
  });

  it('determines isAutoSendEligible only when connected AND setting is true', async () => {
    const { db } = getDatabase();
    // Set setting to true
    await db
      .insert(settings)
      .values({ key: 'auto_send_whatsapp', value: 'true', updated_at: new Date().toISOString() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: 'true' },
      });

    // But driver is still disconnected
    expect(await isAutoSendEligible()).toBe(false);

    // Now connect driver
    mockStatus = 'connected';
    expect(await isAutoSendEligible()).toBe(true);

    // Disable setting
    await db
      .insert(settings)
      .values({ key: 'auto_send_whatsapp', value: 'false', updated_at: new Date().toISOString() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: 'false' },
      });
    expect(await isAutoSendEligible()).toBe(false);
  });

  it('sends headless message successfully when connected', async () => {
    mockStatus = 'connected';
    const result = await sendHeadlessMessage('19987654321', 'Olá, proposta!');

    expect(result.success).toBe(true);
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].phone).toBe('19987654321');
    expect(sentMessages[0].message).toBe('Olá, proposta!');
  });

  it('returns error when sending to invalid number or when disconnected', async () => {
    mockStatus = 'disconnected';
    const disconnectedResult = await sendHeadlessMessage('19987654321', 'Teste');
    expect(disconnectedResult.success).toBe(false);
    expect(disconnectedResult.error).toContain('não está conectado');

    mockStatus = 'connected';
    const invalidResult = await sendHeadlessMessage('19000000000', 'Teste');
    expect(invalidResult.success).toBe(false);
    expect(invalidResult.error).toContain('inválido');
  });

  it('logs out session properly', async () => {
    mockStatus = 'connected';
    await logoutWhatsAppSession();
    const status = await getWhatsAppSessionStatus();
    expect(status.status).toBe('disconnected');
    expect(status.qrCode).toBeNull();
  });
});
