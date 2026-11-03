import { getDatabase } from '../db';
import { leads, cards, boards, columns } from '../db/schema';
import { parseCsv, normalizeRawLead } from './csv-parser';
import type { ParsedLead, ImportAnalysisResult, ImportOptions } from '../types';
import { eq, inArray, asc, desc } from 'drizzle-orm';
import crypto from 'crypto';

export interface ImportSummary {
  insertedCount: number;
  cardsCreated: number;
  updatedCount?: number;
}

export interface IngestionSummary {
  totalReceived: number;
  insertedCount: number;
  duplicatesCount: number;
  cardsCreated: number;
}

export { normalizeRawLead };

/**
 * Shared analysis and deduplication logic against SQLite and intra-batch duplicates.
 */
export async function analyzeParsedLeads(
  parsed: ParsedLead[]
): Promise<ImportAnalysisResult> {
  if (parsed.length === 0) {
    return {
      totalRows: 0,
      newLeads: [],
      duplicateLeads: [],
    };
  }

  const { db } = getDatabase();

  // 1. Collect phones to query DB
  const validPhones = Array.from(new Set(parsed.map((p) => p.normalized_phone).filter(Boolean)));
  const existingMap = new Map<string, string>(); // normalized_phone -> leadId

  if (validPhones.length > 0) {
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

  // 2. Query DB for existing phoneless leads by name + nicho
  const phonelessLeads = parsed.filter((l) => !l.normalized_phone && l.name);
  const existingPhonelessNames = new Map<string, string>(); // nameKey -> leadId

  if (phonelessLeads.length > 0) {
    const existingInDb = await db
      .select({ id: leads.id, name: leads.name, nicho: leads.nicho })
      .from(leads)
      .where(eq(leads.normalized_phone, ''));

    for (const row of existingInDb) {
      const key = `${row.name.trim().toLowerCase()}::${row.nicho.trim().toLowerCase()}`;
      existingPhonelessNames.set(key, row.id);
    }
  }

  const seenPhonesInFile = new Set<string>();
  const seenNamesInFile = new Set<string>();
  const newLeads: ParsedLead[] = [];
  const duplicateLeads: ImportAnalysisResult['duplicateLeads'] = [];

  for (const lead of parsed) {
    const phone = lead.normalized_phone;
    const nameKey = `${(lead.name || '').trim().toLowerCase()}::${(lead.nicho || '').trim().toLowerCase()}`;

    if (!phone) {
      if (seenNamesInFile.has(nameKey)) {
        duplicateLeads.push({
          lead,
          reason: 'file_duplicate',
        });
        continue;
      }

      if (existingPhonelessNames.has(nameKey)) {
        duplicateLeads.push({
          lead,
          existingLeadId: existingPhonelessNames.get(nameKey),
          reason: 'db_duplicate',
        });
        seenNamesInFile.add(nameKey);
        continue;
      }

      seenNamesInFile.add(nameKey);
      newLeads.push(lead);
      continue;
    }

    if (seenPhonesInFile.has(phone)) {
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
      seenPhonesInFile.add(phone);
      continue;
    }

    seenPhonesInFile.add(phone);
    seenNamesInFile.add(nameKey);
    newLeads.push(lead);
  }

  return {
    totalRows: parsed.length,
    newLeads,
    duplicateLeads,
  };
}

export async function parseAndAnalyzeCsv(csvContent: string): Promise<ImportAnalysisResult> {
  const parsed = parseCsv(csvContent);
  return analyzeParsedLeads(parsed);
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

  // Execute in an atomic transaction
  await db.transaction(async (tx) => {
    let startOrder = 0;
    if (targetBoardId && targetColumnId) {
      const [lastCard] = await tx
        .select({ order: cards.order })
        .from(cards)
        .where(eq(cards.column_id, targetColumnId))
        .orderBy(desc(cards.order))
        .limit(1);
      if (lastCard && typeof lastCard.order === 'number') {
        startOrder = lastCard.order + 1;
      }
    }

    for (let i = 0; i < leadsToInsert.length; i++) {
      const lead = leadsToInsert[i];
      const leadId = crypto.randomUUID();

      // Build structured notes containing rating and google maps url
      const noteParts: string[] = [];
      if (lead.rating !== null && lead.rating !== undefined) {
        noteParts.push(`Avaliação: ${lead.rating} (${lead.reviews_count ?? 0} avaliações)`);
      }
      if (lead.google_maps_url) {
        noteParts.push(`Maps: ${lead.google_maps_url}`);
      }
      const notes = noteParts.length > 0 ? noteParts.join(' | ') : null;

      await tx.insert(leads).values({
        id: leadId,
        name: lead.name,
        phone: lead.phone,
        normalized_phone: lead.normalized_phone,
        has_website: lead.has_website,
        website: lead.website,
        nicho: lead.nicho,
        location: lead.location,
        status: 'novo',
        notes,
        created_at: now,
        updated_at: now,
      });
      insertedCount++;

      if (targetBoardId && targetColumnId) {
        const cardId = crypto.randomUUID();
        const descParts = [lead.nicho];
        if (lead.location) descParts.push(lead.location);
        if (lead.rating !== null && lead.rating !== undefined) descParts.push(`⭐ ${lead.rating}`);

        await tx.insert(cards).values({
          id: cardId,
          board_id: targetBoardId,
          column_id: targetColumnId,
          lead_id: leadId,
          title: lead.name,
          description: descParts.join(' | '),
          order: startOrder + i,
          created_at: now,
        });
        cardsCreated++;
      }
    }
  });

  return {
    insertedCount,
    cardsCreated,
  };
}

export async function ingestRawLeads(
  rawLeads: Array<Record<string, any>>,
  options: ImportOptions = {}
): Promise<IngestionSummary> {
  const normalized = rawLeads
    .map(normalizeRawLead)
    .filter((l) => Boolean(l.name || l.phone));

  if (normalized.length === 0) {
    return {
      totalReceived: rawLeads.length,
      insertedCount: 0,
      duplicatesCount: 0,
      cardsCreated: 0,
    };
  }

  const analysis = await analyzeParsedLeads(normalized);
  const importResult = await executeImport(analysis.newLeads, options);

  return {
    totalReceived: rawLeads.length,
    insertedCount: importResult.insertedCount,
    duplicatesCount: analysis.duplicateLeads.length,
    cardsCreated: importResult.cardsCreated,
  };
}
