import { getDatabase } from '../db';
import { leads, cards, boards, columns } from '../db/schema';
import { parseCsv, normalizePhone } from './csv-parser';
import type { ParsedLead, ImportAnalysisResult, ImportOptions } from '../types';
import { eq, inArray, asc } from 'drizzle-orm';
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

export function normalizeRawLead(raw: Record<string, any>): ParsedLead {
  const name = String(raw.name || raw.Nome || raw.nome || raw.title || raw.empresa || raw.Empresa || '').trim();
  const phone = String(raw.phone || raw.Telefone || raw.telefone || raw.celular || raw.Celular || '').trim();
  const normalized_phone = raw.normalized_phone || raw.normalizedPhone
    ? normalizePhone(String(raw.normalized_phone || raw.normalizedPhone))
    : normalizePhone(phone);

  const rawWebsite = raw.website || raw.Website || raw.site || raw.Site || '';
  const websiteStr = String(rawWebsite).trim();
  const hasWebsiteExplicit =
    raw.has_website === 'true' ||
    raw.has_website === true ||
    raw.has_website === '1' ||
    raw.has_website === 1 ||
    raw.hasWebsite === true ||
    raw.hasWebsite === 'true' ||
    raw.hasWebsite === 1 ||
    raw.hasWebsite === '1';

  const website = websiteStr && websiteStr !== 'null' && websiteStr !== 'undefined' ? websiteStr : null;
  const has_website = hasWebsiteExplicit || Boolean(website) ? 1 : 0;

  const nicho = String(raw.nicho || raw.Nicho || raw.categoria || raw.category || 'Geral').trim();
  const rawLocation = raw.location || raw.Location || raw.Cidade || raw.cidade || raw.endereco || raw.Endereco;
  const location = rawLocation ? String(rawLocation).trim() : null;

  const rawRating = raw.rating || raw.Rating || raw.avaliacao || raw.Avaliacao || raw.Avaliação;
  const ratingNum = rawRating !== undefined && rawRating !== null ? parseFloat(String(rawRating).replace(',', '.')) : null;
  const rating = ratingNum !== null && !isNaN(ratingNum) ? ratingNum : null;

  const rawReviews = raw.reviews_count || raw.reviewsCount || raw.ReviewsCount || raw.avaliacoes || raw.Avaliacoes;
  const reviewsNum = rawReviews !== undefined && rawReviews !== null ? parseInt(String(rawReviews), 10) : null;
  const reviews_count = reviewsNum !== null && !isNaN(reviewsNum) ? reviewsNum : null;

  const rawGoogleMapsUrl = raw.google_maps_url || raw.googleMapsUrl || raw.GoogleMapsUrl || raw.maps_url || raw.mapsUrl;
  const google_maps_url = rawGoogleMapsUrl ? String(rawGoogleMapsUrl).trim() : null;

  return {
    name,
    phone,
    normalized_phone,
    has_website,
    website,
    nicho,
    location,
    rating,
    reviews_count,
    google_maps_url,
  };
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
  const seenNamesInFile = new Set<string>();
  const newLeads: ParsedLead[] = [];
  const duplicateLeads: ImportAnalysisResult['duplicateLeads'] = [];

  for (const lead of parsed) {
    const phone = lead.normalized_phone;
    const nameKey = (lead.name || '').trim().toLowerCase() + '::' + (lead.nicho || '').trim().toLowerCase();

    if (!phone) {
      if (seenNamesInFile.has(nameKey)) {
        duplicateLeads.push({
          lead,
          reason: 'file_duplicate',
        });
        continue;
      }
      seenNamesInFile.add(nameKey);
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
    seenNamesInFile.add(nameKey);
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

  const { db } = getDatabase();

  // Collect phones to query DB
  const validPhones = Array.from(new Set(normalized.map((p) => p.normalized_phone).filter(Boolean)));
  const existingMap = new Map<string, string>();

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

  const seenInFile = new Set<string>();
  const seenNamesInFile = new Set<string>();
  const leadsToInsert: ParsedLead[] = [];
  let duplicatesCount = 0;

  for (const lead of normalized) {
    const phone = lead.normalized_phone;
    const nameKey = (lead.name || '').trim().toLowerCase() + '::' + (lead.nicho || '').trim().toLowerCase();

    if (!phone) {
      if (seenNamesInFile.has(nameKey)) {
        duplicatesCount++;
        continue;
      }
      seenNamesInFile.add(nameKey);
      leadsToInsert.push(lead);
      continue;
    }

    if (seenInFile.has(phone)) {
      duplicatesCount++;
      continue;
    }

    if (existingMap.has(phone)) {
      duplicatesCount++;
      seenInFile.add(phone);
      continue;
    }

    seenInFile.add(phone);
    seenNamesInFile.add(nameKey);
    leadsToInsert.push(lead);
  }

  const importResult = await executeImport(leadsToInsert, options);

  return {
    totalReceived: rawLeads.length,
    insertedCount: importResult.insertedCount,
    duplicatesCount,
    cardsCreated: importResult.cardsCreated,
  };
}
