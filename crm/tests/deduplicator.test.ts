import { describe, it, expect, beforeEach } from 'vitest';
import { getDatabase, initDatabase } from '../src/db/index';
import { leads, boards, columns, cards } from '../src/db/schema';
import { normalizePhone, parseCsv } from '../src/lib/csv-parser';
import { parseAndAnalyzeCsv, executeImport } from '../src/lib/deduplicator';
import { eq } from 'drizzle-orm';

describe('CSV Parser & Smart Deduplicator', () => {
  beforeEach(async () => {
    process.env.DATABASE_URL = 'file::memory:?cache=shared';
    await initDatabase();
    const { client } = getDatabase();
    await client.execute('DELETE FROM cards');
    await client.execute('DELETE FROM leads');
  });

  describe('normalizePhone', () => {
    it('cleans non-digits and normalizes Brazilian numbers', () => {
      expect(normalizePhone('(11) 98765-4321')).toBe('11987654321');
      expect(normalizePhone('+55 (11) 98765-4321')).toBe('11987654321');
      expect(normalizePhone('551938001234')).toBe('1938001234');
      expect(normalizePhone('11 98888 7777')).toBe('11988887777');
    });
  });

  describe('parseCsv', () => {
    it('parses CSV with UTF-8 BOM and standard headers', () => {
      const csvWithBom = '\uFEFFname,phone,nicho,has_website,website,location\n' +
        '"Sorriso Ideal","(11) 91111-2222","Dentista","true","https://sorriso.com","São Paulo, SP"\n' +
        '"Dr. Silva","(11) 93333-4444","Médico","false","","Campinas, SP"';

      const parsed = parseCsv(csvWithBom);
      expect(parsed.length).toBe(2);
      expect(parsed[0].name).toBe('Sorriso Ideal');
      expect(parsed[0].normalized_phone).toBe('11911112222');
      expect(parsed[0].has_website).toBe(1);
      expect(parsed[0].website).toBe('https://sorriso.com');
      expect(parsed[1].has_website).toBe(0);
      expect(parsed[1].website).toBeNull();
    });
  });

  describe('parseAndAnalyzeCsv', () => {
    it('categorizes new leads, database duplicates, and intra-file duplicates', async () => {
      const { db } = getDatabase();

      // Pre-populate DB with one existing lead
      await db.insert(leads).values({
        id: 'existing-lead-1',
        name: 'Clínica Antiga',
        phone: '(11) 92222-3333',
        normalized_phone: '11922223333',
        has_website: 1,
        website: 'https://antiga.com',
        nicho: 'Estética',
        location: 'São Paulo',
        status: 'em_contato',
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const csvContent =
        'name,phone,nicho,has_website,website,location\n' +
        '"Novo Lead 1","(11) 91111-1111","Dentista","false","","São Paulo"\n' +
        '"Lead Já Cadastrado","(11) 92222-3333","Estética","true","https://antiga.com","São Paulo"\n' +
        '"Duplicado do Item 1","(11) 91111-1111","Dentista","false","","São Paulo"';

      const analysis = await parseAndAnalyzeCsv(csvContent);

      expect(analysis.totalRows).toBe(3);
      expect(analysis.newLeads.length).toBe(1);
      expect(analysis.newLeads[0].name).toBe('Novo Lead 1');
      expect(analysis.newLeads[0].normalized_phone).toBe('11911111111');

      expect(analysis.duplicateLeads.length).toBe(2);

      const dbDup = analysis.duplicateLeads.find(d => d.reason === 'db_duplicate');
      expect(dbDup).toBeDefined();
      expect(dbDup?.lead.name).toBe('Lead Já Cadastrado');
      expect(dbDup?.existingLeadId).toBe('existing-lead-1');

      const fileDup = analysis.duplicateLeads.find(d => d.reason === 'file_duplicate');
      expect(fileDup).toBeDefined();
      expect(fileDup?.lead.name).toBe('Duplicado do Item 1');
    });
  });

  describe('executeImport', () => {
    it('inserts leads and generates Kanban cards in target column', async () => {
      const { db } = getDatabase();
      const [board] = await db.select().from(boards).where(eq(boards.title, 'Prospecção Geral'));
      const [firstCol] = await db.select().from(columns).where(eq(columns.board_id, board.id)).limit(1);

      const leadsToImport = [
        {
          name: 'Empresa Teste Alpha',
          phone: '(19) 99999-0001',
          normalized_phone: '19999990001',
          has_website: 0,
          website: null,
          nicho: 'Academia',
          location: 'Campinas, SP',
        },
      ];

      const summary = await executeImport(leadsToImport, {
        boardId: board.id,
        columnId: firstCol.id,
      });

      expect(summary.insertedCount).toBe(1);

      const dbLeads = await db.select().from(leads).where(eq(leads.normalized_phone, '19999990001'));
      expect(dbLeads.length).toBe(1);
      expect(dbLeads[0].name).toBe('Empresa Teste Alpha');

      const dbCards = await db.select().from(cards).where(eq(cards.lead_id, dbLeads[0].id));
      expect(dbCards.length).toBe(1);
      expect(dbCards[0].column_id).toBe(firstCol.id);
      expect(dbCards[0].title).toBe('Empresa Teste Alpha');
    });
  });
});
