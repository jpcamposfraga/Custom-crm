import { describe, it, expect, beforeEach } from 'vitest';
import { getDatabase, initDatabase } from '../src/db/index';
import { leads, cards, columns, boards } from '../src/db/schema';
import { POST } from '../src/app/api/leads/route';
import { eq } from 'drizzle-orm';

describe('POST /api/leads - Create Lead with Duplicate Phone Validation & Kanban Card', () => {
  beforeEach(async () => {
    process.env.DATABASE_URL = 'file::memory:?cache=shared';
    await initDatabase();
    const { client } = getDatabase();
    await client.execute('DELETE FROM cards');
    await client.execute('DELETE FROM leads');
  });

  it('successfully creates a new lead and links an initial Kanban card', async () => {
    const { db } = getDatabase();
    const [board] = await db.select().from(boards).where(eq(boards.title, 'Prospecção Geral'));

    const req = new Request('http://localhost:3000/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Clínica Nova Vida',
        phone: '(19) 98765-4321',
        nicho: 'Fisioterapia',
        location: 'Campinas, SP',
        website: 'https://novavida.com.br',
        notes: 'Contato direto com Dr. Carlos',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.lead).toBeDefined();
    expect(json.lead.name).toBe('Clínica Nova Vida');
    expect(json.lead.normalized_phone).toBe('19987654321');
    expect(json.lead.has_website).toBe(1);

    // Verify lead stored in DB
    const [savedLead] = await db.select().from(leads).where(eq(leads.id, json.lead.id));
    expect(savedLead).toBeDefined();
    expect(savedLead.nicho).toBe('Fisioterapia');

    // Verify card created in the first column of the default board
    const [firstCol] = await db
      .select()
      .from(columns)
      .where(eq(columns.board_id, board.id))
      .orderBy(columns.order)
      .limit(1);

    const [savedCard] = await db.select().from(cards).where(eq(cards.lead_id, json.lead.id));
    expect(savedCard).toBeDefined();
    expect(savedCard.board_id).toBe(board.id);
    expect(savedCard.column_id).toBe(firstCol.id);
    expect(savedCard.title).toBe('Clínica Nova Vida');
  });

  it('rejects duplicate lead creation with 409 Conflict if phone is already registered', async () => {
    const { db } = getDatabase();

    // Insert an existing lead
    await db.insert(leads).values({
      id: 'existing-lead-1',
      name: 'Advocacia Silva',
      phone: '(19) 98765-4321',
      normalized_phone: '19987654321',
      has_website: 0,
      website: null,
      nicho: 'Direito',
      location: 'Campinas, SP',
      status: 'novo',
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Try creating another lead with formatted or unformatted same phone
    const req = new Request('http://localhost:3000/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Silva & Associados',
        phone: '+55 (19) 98765-4321',
        nicho: 'Direito Civil',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
    const json = await res.json();

    expect(json.error).toMatch(/já cadastrado/i);
    expect(json.existingLead).toBeDefined();
    expect(json.existingLead.name).toBe('Advocacia Silva');

    // Ensure no second lead was created
    const allLeads = await db.select().from(leads);
    expect(allLeads.length).toBe(1);
  });

  it('rejects creation with 400 Bad Request if name or phone are missing', async () => {
    const reqMissingPhone = new Request('http://localhost:3000/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Apenas Nome',
        phone: '',
      }),
    });

    const res = await POST(reqMissingPhone);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/obrigatórios/i);
  });
});
