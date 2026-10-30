import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, initDatabase } from '../src/db';
import { scheduledMessages, leads } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import {
  isMessageDue,
  checkAndTriggerDueMessages,
  setUrlLauncher,
  resetUrlLauncher,
  stopSchedulerWorker,
} from '../src/lib/scheduler-worker';

describe('Scheduler Worker (Singleton & Sequential Queue)', () => {
  const launchedUrls: string[] = [];

  beforeEach(async () => {
    launchedUrls.length = 0;
    setUrlLauncher(async (url: string) => {
      launchedUrls.push(url);
    });
    await initDatabase();
  });

  afterEach(() => {
    resetUrlLauncher();
    stopSchedulerWorker();
  });

  it('correctly calculates isMessageDue', () => {
    const now = Date.now();
    const past = new Date(now - 60000).toISOString();
    const future = new Date(now + 60000).toISOString();

    expect(isMessageDue(past, now)).toBe(true);
    expect(isMessageDue(future, now)).toBe(false);
    expect(isMessageDue('invalid-date', now)).toBe(false);
  });

  it('triggers due messages sequentially and updates DB status to enviado', async () => {
    const { db } = getDatabase();
    const leadId1 = crypto.randomUUID();
    const leadId2 = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    // Insert 2 leads
    await db.insert(leads).values([
      {
        id: leadId1,
        name: 'Cliente Alpha',
        phone: '(11) 98888-1111',
        normalized_phone: '11988881111',
        has_website: 1,
        nicho: 'Advocacia',
        created_at: nowIso,
        updated_at: nowIso,
      },
      {
        id: leadId2,
        name: 'Cliente Beta',
        phone: '(21) 97777-2222',
        normalized_phone: '21977772222',
        has_website: 0,
        nicho: 'Odontologia',
        created_at: nowIso,
        updated_at: nowIso,
      },
    ]);

    const msgId1 = crypto.randomUUID();
    const msgId2 = crypto.randomUUID();
    const msgIdFuture = crypto.randomUUID();

    const pastDate1 = new Date(Date.now() - 100000).toISOString();
    const pastDate2 = new Date(Date.now() - 50000).toISOString();
    const futureDate = new Date(Date.now() + 500000).toISOString();

    await db.insert(scheduledMessages).values([
      {
        id: msgId1,
        lead_id: leadId1,
        message: 'Olá Alpha!',
        scheduled_for: pastDate1,
        status: 'pendente',
        platform: 'web',
        created_at: nowIso,
      },
      {
        id: msgId2,
        lead_id: leadId2,
        message: 'Olá Beta!',
        scheduled_for: pastDate2,
        status: 'pendente',
        platform: 'app',
        created_at: nowIso,
      },
      {
        id: msgIdFuture,
        lead_id: leadId1,
        message: 'Mensagem Futura',
        scheduled_for: futureDate,
        status: 'pendente',
        platform: 'web',
        created_at: nowIso,
      },
    ]);

    // Run trigger with 0 delay for fast test
    const result = await checkAndTriggerDueMessages({ delayBetweenMs: 0 });

    expect(result.processedCount).toBe(2);
    expect(result.errors).toHaveLength(0);

    // Verify launched URLs
    expect(launchedUrls).toHaveLength(2);
    expect(launchedUrls[0]).toContain('web.whatsapp.com/send');
    expect(launchedUrls[0]).toContain('phone=5511988881111');
    expect(launchedUrls[0]).toContain('Ol%C3%A1%20Alpha!');

    expect(launchedUrls[1]).toContain('whatsapp://send');
    expect(launchedUrls[1]).toContain('phone=5521977772222');
    expect(launchedUrls[1]).toContain('Ol%C3%A1%20Beta!');

    // Verify DB statuses
    const [saved1] = await db.select().from(scheduledMessages).where(eq(scheduledMessages.id, msgId1));
    const [saved2] = await db.select().from(scheduledMessages).where(eq(scheduledMessages.id, msgId2));
    const [savedFuture] = await db.select().from(scheduledMessages).where(eq(scheduledMessages.id, msgIdFuture));

    expect(saved1.status).toBe('enviado');
    expect(saved2.status).toBe('enviado');
    expect(savedFuture.status).toBe('pendente');

    // Verify lead status updated to 'em_contato'
    const [lead1] = await db.select().from(leads).where(eq(leads.id, leadId1));
    expect(lead1.status).toBe('em_contato');

    // Cleanup
    await db.delete(scheduledMessages).where(eq(scheduledMessages.id, msgId1));
    await db.delete(scheduledMessages).where(eq(scheduledMessages.id, msgId2));
    await db.delete(scheduledMessages).where(eq(scheduledMessages.id, msgIdFuture));
    await db.delete(leads).where(eq(leads.id, leadId1));
    await db.delete(leads).where(eq(leads.id, leadId2));
  });

  it('cancels scheduled message if lead has empty phone', async () => {
    const { db } = getDatabase();
    const leadIdEmptyPhone = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    await db.insert(leads).values({
      id: leadIdEmptyPhone,
      name: 'Cliente Sem Fone',
      phone: '',
      normalized_phone: '',
      has_website: 0,
      nicho: 'Testes',
      created_at: nowIso,
      updated_at: nowIso,
    });

    const msgId1 = crypto.randomUUID();

    await db.insert(scheduledMessages).values({
      id: msgId1,
      lead_id: leadIdEmptyPhone,
      message: 'Esta mensagem deve ser cancelada (telefone vazio)',
      scheduled_for: new Date(Date.now() - 10000).toISOString(),
      status: 'pendente',
      platform: 'web',
      created_at: nowIso,
    });

    const result = await checkAndTriggerDueMessages({ delayBetweenMs: 0 });

    expect(result.processedCount).toBe(0);
    expect(result.errors.length).toBe(1);
    expect(launchedUrls).toHaveLength(0);

    const [saved1] = await db.select().from(scheduledMessages).where(eq(scheduledMessages.id, msgId1));
    expect(saved1.status).toBe('cancelado');

    // Cleanup
    await db.delete(scheduledMessages).where(eq(scheduledMessages.id, msgId1));
    await db.delete(leads).where(eq(leads.id, leadIdEmptyPhone));
  });

  it('prevents concurrent processing when queue is already locked', async () => {
    const { db } = getDatabase();
    const leadId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    await db.insert(leads).values({
      id: leadId,
      name: 'Cliente Concorrência',
      phone: '11999990000',
      normalized_phone: '11999990000',
      has_website: 0,
      nicho: 'Testes',
      created_at: nowIso,
      updated_at: nowIso,
    });

    const msgId = crypto.randomUUID();
    await db.insert(scheduledMessages).values({
      id: msgId,
      lead_id: leadId,
      message: 'Msg lenta',
      scheduled_for: new Date(Date.now() - 1000).toISOString(),
      status: 'pendente',
      platform: 'web',
      created_at: nowIso,
    });

    // Launcher that takes 100ms
    setUrlLauncher(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Fire first run
    const p1 = checkAndTriggerDueMessages({ delayBetweenMs: 0 });
    // Immediately attempt second run
    const p2 = checkAndTriggerDueMessages({ delayBetweenMs: 0 });

    const [res1, res2] = await Promise.all([p1, p2]);

    // One of them must have succeeded, the other must have rejected/skipped due to lock
    const lockedRes = res1.errors.includes('Worker já está processando a fila') ? res1 : res2;
    const okRes = lockedRes === res1 ? res2 : res1;

    expect(lockedRes.errors).toContain('Worker já está processando a fila');
    expect(okRes.processedCount).toBe(1);

    // Cleanup
    await db.delete(scheduledMessages).where(eq(scheduledMessages.id, msgId));
    await db.delete(leads).where(eq(leads.id, leadId));
  });
});
