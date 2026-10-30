import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const leads = sqliteTable('leads', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  normalized_phone: text('normalized_phone').notNull(),
  has_website: integer('has_website').notNull().default(0),
  website: text('website'),
  nicho: text('nicho').notNull(),
  location: text('location'),
  status: text('status').$type<'novo' | 'em_contato' | 'convertido' | 'perdido'>().notNull().default('novo'),
  notes: text('notes'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

export const boards = sqliteTable('boards', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  type: text('type').notNull().default('leads'),
  created_at: text('created_at').notNull(),
});

export const columns = sqliteTable('columns', {
  id: text('id').primaryKey(),
  board_id: text('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  order: integer('order').notNull(),
  is_converted_stage: integer('is_converted_stage').notNull().default(0),
  is_lost_stage: integer('is_lost_stage').notNull().default(0),
});

export const cards = sqliteTable('cards', {
  id: text('id').primaryKey(),
  board_id: text('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  column_id: text('column_id').notNull().references(() => columns.id, { onDelete: 'cascade' }),
  lead_id: text('lead_id').references(() => leads.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description'),
  order: integer('order').notNull(),
  created_at: text('created_at').notNull(),
});

export const messageTemplates = sqliteTable('message_templates', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  created_at: text('created_at').notNull(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updated_at: text('updated_at').notNull(),
});

export const scheduledMessages = sqliteTable('scheduled_messages', {
  id: text('id').primaryKey(),
  lead_id: text('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  message: text('message').notNull(),
  scheduled_for: text('scheduled_for').notNull(),
  status: text('status').$type<'pendente' | 'enviado' | 'cancelado'>().notNull().default('pendente'),
  platform: text('platform').notNull().default('web'),
  created_at: text('created_at').notNull(),
});
