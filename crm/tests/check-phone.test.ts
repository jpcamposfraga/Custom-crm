import { describe, it, expect, beforeEach } from 'vitest';
import { getDatabase, initDatabase } from '../src/db/index';
import { leads, cards, columns, boards } from '../src/db/schema';
import { normalizePhone } from '../src/lib/csv-parser';
import { eq } from 'drizzle-orm';

describe('Phone Checker Logic', () => {
  beforeEach(async () => {
    process.env.DATABASE_URL = 'file::memory:?cache=shared';
    await initDatabase();
    const { client } = getDatabase();
    await client.execute('DELETE FROM cards');
    await client.execute('DELETE FROM leads');
  });

  it('detects existing lead with current stage column name', async () => {
    const { db } = getDatabase();
    const [board] = await db.select().from(boards).where(eq(boards.title, 'Prospecção Geral'));
    const [contactCol] = await db.select().from(columns).where(eq(columns.title, 'Contato Feito'));

    const leadId = 'lead-check-1';
    await db.insert(leads).values({
      id: leadId,
      name: 'Clínica Sorriso Aberto',
      phone: '(11) 98888-7777',
      normalized_phone: normalizePhone('(11) 98888-7777'),
      has_website: 1,
      website: 'https://sorrisoaberto.com.br',
      nicho: 'Odontologia',
      location: 'São Paulo, SP',
      status: 'em_contato',
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await db.insert(cards).values({
      id: 'card-check-1',
      board_id: board.id,
      column_id: contactCol.id,
      lead_id: leadId,
      title: 'Clínica Sorriso Aberto',
      description: 'Nicho: Odontologia',
      order: 0,
      created_at: new Date().toISOString(),
    });

    const searchDigits = normalizePhone('+55 11 98888-7777');
    const [foundLead] = await db.select().from(leads).where(eq(leads.normalized_phone, searchDigits));
    expect(foundLead).toBeDefined();
    expect(foundLead.name).toBe('Clínica Sorriso Aberto');

    // Check card join
    const [card] = await db.select().from(cards).where(eq(cards.lead_id, foundLead.id));
    const [column] = await db.select().from(columns).where(eq(columns.id, card.column_id));
    expect(column.title).toBe('Contato Feito');
  });

  it('returns not found for unregistered number', async () => {
    const { db } = getDatabase();
    const searchDigits = normalizePhone('11900000000');
    const results = await db.select().from(leads).where(eq(leads.normalized_phone, searchDigits));
    expect(results.length).toBe(0);
  });
});
