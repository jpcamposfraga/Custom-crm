import { describe, it, expect, beforeEach } from 'vitest';
import { getDatabase, initDatabase } from '../src/db/index';
import { leads, boards, columns, cards } from '../src/db/schema';
import { ingestRawLeads } from '../src/lib/deduplicator';
import { POST } from '../src/app/api/leads/import/route';
import { eq } from 'drizzle-orm';

describe('Direct Leads Ingestion & Deduplication', () => {
  beforeEach(async () => {
    process.env.DATABASE_URL = 'file::memory:?cache=shared';
    await initDatabase();
    const { client } = getDatabase();
    await client.execute('DELETE FROM cards');
    await client.execute('DELETE FROM leads');
  });

  it('ingests raw scraper leads (camelCase) and creates Kanban cards', async () => {
    const rawLeads = [
      {
        name: 'Dentista Alpha',
        phone: '(19) 98765-4321',
        normalizedPhone: '19987654321',
        nicho: 'Dentista',
        hasWebsite: true,
        website: 'https://alpha.com',
        location: 'Campinas, SP',
        rating: 4.9,
        reviewsCount: 30,
        googleMapsUrl: 'https://maps.google.com/alpha',
      },
      {
        name: 'Clínica Beta',
        phone: '(19) 3333-2222',
        normalizedPhone: '1933332222',
        nicho: 'Estética',
        hasWebsite: false,
        website: '',
        location: 'Campinas, SP',
        rating: 5,
        reviewsCount: 10,
        googleMapsUrl: 'https://maps.google.com/beta',
      },
    ];

    const summary = await ingestRawLeads(rawLeads);

    expect(summary.totalReceived).toBe(2);
    expect(summary.insertedCount).toBe(2);
    expect(summary.duplicatesCount).toBe(0);
    expect(summary.cardsCreated).toBe(2);

    const { db } = getDatabase();
    const dbLeads = await db.select().from(leads);
    expect(dbLeads).toHaveLength(2);

    const alpha = dbLeads.find((l) => l.normalized_phone === '19987654321');
    expect(alpha).toBeDefined();
    expect(alpha?.name).toBe('Dentista Alpha');
    expect(alpha?.has_website).toBe(1);
    expect(alpha?.website).toBe('https://alpha.com');

    const dbCards = await db.select().from(cards);
    expect(dbCards).toHaveLength(2);
  });

  it('skips existing database duplicates and intra-batch duplicates', async () => {
    const { db } = getDatabase();

    // Seed existing lead
    await db.insert(leads).values({
      id: 'existing-id-123',
      name: 'Dr. Já Existe',
      phone: '(11) 91111-2222',
      normalized_phone: '11911112222',
      has_website: 0,
      website: null,
      nicho: 'Médico',
      location: 'São Paulo, SP',
      status: 'novo',
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const rawBatch = [
      {
        name: 'Novo Médico',
        phone: '(11) 99999-8888',
        normalizedPhone: '11999998888',
        nicho: 'Médico',
        hasWebsite: false,
      },
      {
        name: 'Tentativa Duplicada do Banco',
        phone: '(11) 91111-2222',
        normalizedPhone: '11911112222',
        nicho: 'Médico',
        hasWebsite: false,
      },
      {
        name: 'Repetido no Lote',
        phone: '(11) 99999-8888',
        normalizedPhone: '11999998888',
        nicho: 'Médico',
        hasWebsite: false,
      },
    ];

    const summary = await ingestRawLeads(rawBatch);

    expect(summary.totalReceived).toBe(3);
    expect(summary.insertedCount).toBe(1);
    expect(summary.duplicatesCount).toBe(2);
    expect(summary.cardsCreated).toBe(1);

    const allLeads = await db.select().from(leads);
    expect(allLeads).toHaveLength(2); // 1 existing + 1 new
  });

  it('handles POST /api/leads/import with direct { leads: [...] } payload', async () => {
    const req = new Request('http://localhost:3000/api/leads/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leads: [
          {
            name: 'API Direct Ingest Lead',
            phone: '(47) 98888-1234',
            normalizedPhone: '47988881234',
            nicho: 'Advocacia',
            hasWebsite: true,
            website: 'https://advocacia.com',
          },
        ],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.summary).toBeDefined();
    expect(data.summary.totalReceived).toBe(1);
    expect(data.summary.insertedCount).toBe(1);
    expect(data.summary.duplicatesCount).toBe(0);
    expect(data.summary.cardsCreated).toBe(1);
  });
});
