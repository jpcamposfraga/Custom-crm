import { describe, it, expect, beforeEach } from 'vitest';
import { getDatabase, initDatabase } from '../src/db/index';
import { leads, boards, columns, cards, messageTemplates } from '../src/db/schema';
import { eq } from 'drizzle-orm';

describe('Database Schema & Initialization', () => {
  beforeEach(async () => {
    // initialize in-memory database
    process.env.DATABASE_URL = 'file::memory:?cache=shared';
    await initDatabase();
  });

  it('initializes default board and stages', async () => {
    const { db } = getDatabase();

    const allBoards = await db.select().from(boards);
    expect(allBoards.length).toBeGreaterThanOrEqual(1);
    const defaultBoard = allBoards.find(b => b.title === 'Prospecção Geral');
    expect(defaultBoard).toBeDefined();

    const cols = await db.select().from(columns).where(eq(columns.board_id, defaultBoard!.id));
    expect(cols.length).toBe(5);
    const titles = cols.map(c => c.title);
    expect(titles).toContain('Novo Lead');
    expect(titles).toContain('Contato Feito');
    expect(titles).toContain('Proposta');
    expect(titles).toContain('Convertido');
    expect(titles).toContain('Perdido');

    const convertedCol = cols.find(c => c.title === 'Convertido');
    expect(convertedCol?.is_converted_stage).toBe(1);

    const lostCol = cols.find(c => c.title === 'Perdido');
    expect(lostCol?.is_lost_stage).toBe(1);
  });

  it('seeds default message templates', async () => {
    const { db } = getDatabase();
    const templates = await db.select().from(messageTemplates);
    expect(templates.length).toBeGreaterThanOrEqual(1);
    expect(templates.some(t => t.content.includes('{nome}'))).toBe(true);
  });

  it('inserts and retrieves a lead and card', async () => {
    const { db } = getDatabase();

    const leadId = 'lead-test-1';
    await db.insert(leads).values({
      id: leadId,
      name: 'Clínica Odonto Teste',
      phone: '(11) 98765-4321',
      normalized_phone: '11987654321',
      has_website: 0,
      website: null,
      nicho: 'Dentista',
      location: 'Campinas, SP',
      status: 'novo',
      notes: 'Lead importado',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const [insertedLead] = await db.select().from(leads).where(eq(leads.id, leadId));
    expect(insertedLead.name).toBe('Clínica Odonto Teste');
    expect(insertedLead.normalized_phone).toBe('11987654321');

    const [firstCol] = await db.select().from(columns).limit(1);
    const cardId = 'card-test-1';
    await db.insert(cards).values({
      id: cardId,
      board_id: firstCol.board_id,
      column_id: firstCol.id,
      lead_id: leadId,
      title: 'Clínica Odonto Teste',
      description: 'Nicho: Dentista',
      order: 0,
      created_at: new Date().toISOString(),
    });

    const [insertedCard] = await db.select().from(cards).where(eq(cards.id, cardId));
    expect(insertedCard.lead_id).toBe(leadId);
    expect(insertedCard.title).toBe('Clínica Odonto Teste');
  });
});
