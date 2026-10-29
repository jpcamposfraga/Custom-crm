import { getDatabase } from '../db';
import { leads, cards, boards, columns } from '../db/schema';
import { parseCsv } from './csv-parser';
import type { ParsedLead, ImportAnalysisResult, ImportOptions } from '../types';
import { eq, inArray, asc } from 'drizzle-orm';
import crypto from 'crypto';

export interface ImportSummary {
  insertedCount: number;
  cardsCreated: number;
  updatedCount?: number;
}

export async function parseAndAnalyzeCsv(csvContent: string): Promise<ImportAnalysisResult> {
  const parsed = parseCsv(csvContent);
  if (parsed.length === 0) {
    return {
      totalRows: 0,
      newLeads: [],
      duplicateLeads: [],
    };
  }

  const { db } = getDatabase();

  // Collect phones to query DB
  const validPhones = Array.from(new Set(parsed.map(p => p.normalized_phone).filter(Boolean)));
  const existingMap = new Map<string, string>(); // normalized_phone -> leadId

  if (validPhones.length > 0) {
    // Query in batches of 200 for SQLite limits safety
    const chunkSize = 200;
    for (let i = 0; i < validPhones.length; i += chunkSize) {
      const chunk = validPhones.slice(i, i + chunkSize);
      const existingInDb = await db
        .select({ id: leads.id, phone: leads.normalized_phone })
        .from(leads)
        .where(inArray(leads.normalized_phone, chunk));

      for (const row of existingInDb) {
        existingMap.set(row.phone, row.id);
      }
    }
  }

  const seenInFile = new Set<string>();
  const newLeads: ParsedLead[] = [];
  const duplicateLeads: ImportAnalysisResult['duplicateLeads'] = [];

  for (const lead of parsed) {
    const phone = lead.normalized_phone;

    if (!phone) {
      // If no phone, treat as new lead if name is present
      newLeads.push(lead);
      continue;
    }

    if (seenInFile.has(phone)) {
      duplicateLeads.push({
        lead,
        reason: 'file_duplicate',
      });
      continue;
    }

    if (existingMap.has(phone)) {
      duplicateLeads.push({
        lead,
        existingLeadId: existingMap.get(phone),
        reason: 'db_duplicate',
      });
      seenInFile.add(phone);
      continue;
    }

    seenInFile.add(phone);
    newLeads.push(lead);
  }

  return {
    totalRows: parsed.length,
    newLeads,
    duplicateLeads,
  };
}

export async function executeImport(
  leadsToInsert: ParsedLead[],
  options: ImportOptions = {}
): Promise<ImportSummary> {
  const { db } = getDatabase();

  let targetBoardId = options.boardId;
  let targetColumnId = options.columnId;

  // Resolve board and column if not specified
  if (!targetBoardId || !targetColumnId) {
    const [defaultBoard] = await db.select().from(boards).limit(1);
    if (defaultBoard) {
      targetBoardId = defaultBoard.id;
      const [firstCol] = await db
        .select()
        .from(columns)
        .where(eq(columns.board_id, targetBoardId))
        .orderBy(asc(columns.order))
        .limit(1);
      if (firstCol) {
        targetColumnId = firstCol.id;
      }
    }
  }

  let insertedCount = 0;
  let cardsCreated = 0;
  const now = new Date().toISOString();

  for (let i = 0; i < leadsToInsert.length; i++) {
    const lead = leadsToInsert[i];
    const leadId = crypto.randomUUID();

    await db.insert(leads).values({
      id: leadId,
      name: lead.name,
      phone: lead.phone,
      normalized_phone: lead.normalized_phone,
      has_website: lead.has_website,
      website: lead.website,
      nicho: lead.nicho,
      location: lead.location,
      status: 'novo',
      notes: lead.rating ? `Avaliação: ${lead.rating} (${lead.reviews_count || 0} avaliações)` : null,
      created_at: now,
      updated_at: now,
    });
    insertedCount++;

    if (targetBoardId && targetColumnId) {
      const cardId = crypto.randomUUID();
      const descParts = [lead.nicho];
      if (lead.location) descParts.push(lead.location);
      if (lead.rating) descParts.push(`⭐ ${lead.rating}`);

      await db.insert(cards).values({
        id: cardId,
        board_id: targetBoardId,
        column_id: targetColumnId,
        lead_id: leadId,
        title: lead.name,
        description: descParts.join(' | '),
        order: i,
        created_at: now,
      });
      cardsCreated++;
    }
  }

  return {
    insertedCount,
    cardsCreated,
  };
}
