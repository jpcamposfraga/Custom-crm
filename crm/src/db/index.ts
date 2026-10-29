import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema';
import { eq } from 'drizzle-orm';

let clientInstance: Client | null = null;
let dbInstance: LibSQLDatabase<typeof schema> | null = null;
let currentUrl: string | null = null;

export function getDatabase() {
  const url = process.env.DATABASE_URL || 'file:crm.db';
  if (!clientInstance || !dbInstance || currentUrl !== url) {
    currentUrl = url;
    clientInstance = createClient({ url });
    dbInstance = drizzle(clientInstance, { schema });
  }
  return { client: clientInstance, db: dbInstance };
}

export const db = new Proxy({} as LibSQLDatabase<typeof schema>, {
  get(_target, prop) {
    const { db } = getDatabase();
    return (db as any)[prop];
  },
});

export async function initDatabase(): Promise<void> {
  const { client, db } = getDatabase();

  // Create tables
  await client.execute(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      normalized_phone TEXT NOT NULL,
      has_website INTEGER NOT NULL DEFAULT 0,
      website TEXT,
      nicho TEXT NOT NULL,
      location TEXT,
      status TEXT NOT NULL DEFAULT 'novo',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL DEFAULT 'leads',
      created_at TEXT NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS columns (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      is_converted_stage INTEGER NOT NULL DEFAULT 0,
      is_lost_stage INTEGER NOT NULL DEFAULT 0
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      column_id TEXT NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
      lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      "order" INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS message_templates (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Default Board and Columns seed
  const existingBoards = await db.select().from(schema.boards).where(eq(schema.boards.title, 'Prospecção Geral'));
  let defaultBoardId = 'board-default';

  if (existingBoards.length === 0) {
    const now = new Date().toISOString();
    await db.insert(schema.boards).values({
      id: defaultBoardId,
      title: 'Prospecção Geral',
      description: 'Funil principal de prospecção comercial',
      type: 'leads',
      created_at: now,
    });

    const defaultColumns = [
      { id: 'col-novo', board_id: defaultBoardId, title: 'Novo Lead', order: 0, is_converted_stage: 0, is_lost_stage: 0 },
      { id: 'col-contato', board_id: defaultBoardId, title: 'Contato Feito', order: 1, is_converted_stage: 0, is_lost_stage: 0 },
      { id: 'col-proposta', board_id: defaultBoardId, title: 'Proposta', order: 2, is_converted_stage: 0, is_lost_stage: 0 },
      { id: 'col-convertido', board_id: defaultBoardId, title: 'Convertido', order: 3, is_converted_stage: 1, is_lost_stage: 0 },
      { id: 'col-perdido', board_id: defaultBoardId, title: 'Perdido', order: 4, is_converted_stage: 0, is_lost_stage: 1 },
    ];

    for (const col of defaultColumns) {
      await db.insert(schema.columns).values(col);
    }
  }

  // Default Message Templates seed
  const existingTemplates = await db.select().from(schema.messageTemplates);
  if (existingTemplates.length === 0) {
    const now = new Date().toISOString();
    const defaultTemplates = [
      {
        id: 'tmpl-apresentacao',
        title: 'Apresentação Comercial',
        content: 'Olá {nome}, tudo bem? Me chamo João. Encontrei sua empresa no segmento de {nicho} em {cidade} e gostaria de apresentar uma oportunidade para atrair mais clientes.',
        created_at: now,
      },
      {
        id: 'tmpl-site',
        title: 'Proposta de Website',
        content: 'Olá {nome}! Notei que sua empresa de {nicho} em {cidade} tem grande potencial, mas ainda não possui um site otimizado para conversões no Google. Gostaria de ver uma prévia sem compromisso?',
        created_at: now,
      },
      {
        id: 'tmpl-followup',
        title: 'Follow-up',
        content: 'Olá {nome}, tudo bem? Conseguiram avaliar a mensagem anterior sobre a solução para sua empresa de {nicho}?',
        created_at: now,
      },
    ];

    for (const tmpl of defaultTemplates) {
      await db.insert(schema.messageTemplates).values(tmpl);
    }
  }
}
