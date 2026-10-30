import { describe, it, expect } from 'vitest';
import { getDatabase, initDatabase } from '../src/db';
import { scheduledMessages, leads } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

describe('Scheduled Messages API & Database', () => {
  it('creates and updates a scheduled message for a lead', async () => {
    await initDatabase();
    const { db } = getDatabase();

    // Create a dummy lead
    const leadId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.insert(leads).values({
      id: leadId,
      name: 'Lead de Teste Agendamento',
      phone: '(19) 99999-1111',
      normalized_phone: '19999991111',
      has_website: 0,
      nicho: 'Testes',
      created_at: now,
      updated_at: now,
    });

    // Create scheduled message
    const msgId = crypto.randomUUID();
    const scheduledTime = '2026-11-01T10:00';
    await db.insert(scheduledMessages).values({
      id: msgId,
      lead_id: leadId,
      message: 'Olá, mensagem agendada!',
      scheduled_for: scheduledTime,
      status: 'pendente',
      platform: 'web',
      created_at: now,
    });

    const [saved] = await db
      .select()
      .from(scheduledMessages)
      .where(eq(scheduledMessages.id, msgId));

    expect(saved).toBeDefined();
    expect(saved.status).toBe('pendente');
    expect(saved.message).toBe('Olá, mensagem agendada!');
    expect(saved.scheduled_for).toBe(scheduledTime);

    // Update status to 'enviado'
    await db
      .update(scheduledMessages)
      .set({ status: 'enviado' })
      .where(eq(scheduledMessages.id, msgId));

    const [updated] = await db
      .select()
      .from(scheduledMessages)
      .where(eq(scheduledMessages.id, msgId));

    expect(updated.status).toBe('enviado');

    // Clean up
    await db.delete(scheduledMessages).where(eq(scheduledMessages.id, msgId));
    await db.delete(leads).where(eq(leads.id, leadId));
  });
});
