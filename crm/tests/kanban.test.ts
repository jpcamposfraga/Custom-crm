import { describe, it, expect, beforeEach } from 'vitest';
import { getDatabase, initDatabase } from '../src/db/index';
import { leads, boards, columns, cards } from '../src/db/schema';
import { moveCard } from '../src/lib/kanban-actions';
import { eq } from 'drizzle-orm';

describe('Kanban Logic & Card Movement', () => {
  beforeEach(async () => {
    process.env.DATABASE_URL = 'file::memory:?cache=shared';
    await initDatabase();
    const { client } = getDatabase();
    await client.execute('DELETE FROM cards');
    await client.execute('DELETE FROM leads');
  });

  it('updates lead status to convertido when card is moved to a converted column', async () => {
    const { db } = getDatabase();
    const [board] = await db.select().from(boards).where(eq(boards.title, 'Prospecção Geral'));
    const [newCol] = await db.select().from(columns).where(eq(columns.title, 'Novo Lead'));
    const [convertedCol] = await db.select().from(columns).where(eq(columns.title, 'Convertido'));

    const leadId = 'lead-kanban-1';
    await db.insert(leads).values({
      id: leadId,
      name: 'Empresa Alpha',
      phone: '11999990001',
      normalized_phone: '11999990001',
      has_website: 1,
      website: 'https://alpha.com',
      nicho: 'Advocacia',
      location: 'São Paulo',
      status: 'novo',
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const cardId = 'card-kanban-1';
    await db.insert(cards).values({
      id: cardId,
      board_id: board.id,
      column_id: newCol.id,
      lead_id: leadId,
      title: 'Empresa Alpha',
      description: 'Nicho: Advocacia',
      order: 0,
      created_at: new Date().toISOString(),
    });

    // Execute move card
    await moveCard(cardId, convertedCol.id);

    // Verify card column updated
    const [updatedCard] = await db.select().from(cards).where(eq(cards.id, cardId));
    expect(updatedCard.column_id).toBe(convertedCol.id);

    // Verify lead status automatically updated to 'convertido'
    const [updatedLead] = await db.select().from(leads).where(eq(leads.id, leadId));
    expect(updatedLead.status).toBe('convertido');
  });

  it('updates lead status to perdido when card is moved to a lost column', async () => {
    const { db } = getDatabase();
    const [board] = await db.select().from(boards).where(eq(boards.title, 'Prospecção Geral'));
    const [newCol] = await db.select().from(columns).where(eq(columns.title, 'Novo Lead'));
    const [lostCol] = await db.select().from(columns).where(eq(columns.title, 'Perdido'));

    const leadId = 'lead-kanban-2';
    await db.insert(leads).values({
      id: leadId,
      name: 'Empresa Beta',
      phone: '11999990002',
      normalized_phone: '11999990002',
      has_website: 0,
      website: null,
      nicho: 'Contabilidade',
      location: 'Campinas',
      status: 'em_contato',
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const cardId = 'card-kanban-2';
    await db.insert(cards).values({
      id: cardId,
      board_id: board.id,
      column_id: newCol.id,
      lead_id: leadId,
      title: 'Empresa Beta',
      description: 'Nicho: Contabilidade',
      order: 0,
      created_at: new Date().toISOString(),
    });

    // Execute move card
    await moveCard(cardId, lostCol.id);

    // Verify lead status automatically updated to 'perdido'
    const [updatedLead] = await db.select().from(leads).where(eq(leads.id, leadId));
    expect(updatedLead.status).toBe('perdido');
  });
});
