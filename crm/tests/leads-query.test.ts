import { describe, it, expect, beforeEach } from 'vitest';
import { getDatabase, initDatabase } from '../src/db/index';
import { leads } from '../src/db/schema';
import { eq, desc, asc, and } from 'drizzle-orm';

describe('Leads Query Builder', () => {
  beforeEach(async () => {
    process.env.DATABASE_URL = 'file::memory:?cache=shared';
    await initDatabase();
    const { client } = getDatabase();
    await client.execute('DELETE FROM cards');
    await client.execute('DELETE FROM leads');

    const { db } = getDatabase();
    await db.insert(leads).values([
      {
        id: 'lead-1',
        name: 'Clínica Bella',
        phone: '11911111111',
        normalized_phone: '11911111111',
        has_website: 1,
        website: 'https://bella.com',
        nicho: 'Estética',
        location: 'São Paulo',
        status: 'novo',
        notes: null,
        created_at: '2026-10-01T10:00:00Z',
        updated_at: '2026-10-01T10:00:00Z',
      },
      {
        id: 'lead-2',
        name: 'Academia Corpo Forte',
        phone: '11922222222',
        normalized_phone: '11922222222',
        has_website: 0,
        website: null,
        nicho: 'Academia',
        location: 'Campinas',
        status: 'convertido',
        notes: null,
        created_at: '2026-10-02T10:00:00Z',
        updated_at: '2026-10-02T10:00:00Z',
      },
      {
        id: 'lead-3',
        name: 'Dra. Zilda Odonto',
        phone: '11933333333',
        normalized_phone: '11933333333',
        has_website: 1,
        website: 'https://zilda.com',
        nicho: 'Dentista',
        location: 'Santos',
        status: 'em_contato',
        notes: null,
        created_at: '2026-10-03T10:00:00Z',
        updated_at: '2026-10-03T10:00:00Z',
      },
    ]);
  });

  it('filters by status and has_website', async () => {
    const { db } = getDatabase();
    const results = await db
      .select()
      .from(leads)
      .where(and(eq(leads.status, 'novo'), eq(leads.has_website, 1)));

    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Clínica Bella');
  });

  it('sorts by created_at desc', async () => {
    const { db } = getDatabase();
    const results = await db.select().from(leads).orderBy(desc(leads.created_at));

    expect(results[0].name).toBe('Dra. Zilda Odonto');
    expect(results[2].name).toBe('Clínica Bella');
  });

  it('sorts by nicho asc', async () => {
    const { db } = getDatabase();
    const results = await db.select().from(leads).orderBy(asc(leads.nicho));

    expect(results[0].nicho).toBe('Academia');
    expect(results[1].nicho).toBe('Dentista');
    expect(results[2].nicho).toBe('Estética');
  });
});
