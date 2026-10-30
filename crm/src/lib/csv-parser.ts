import Papa from 'papaparse';
import type { ParsedLead } from '../types';

export function normalizePhone(rawPhone: string): string {
  if (!rawPhone) return '';
  let digits = rawPhone.replace(/\D/g, '');
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  return digits;
}

export function parseCsv(csvContent: string): ParsedLead[] {
  let cleanContent = csvContent.replace(/^\uFEFF/, '').trim();
  if (!cleanContent) return [];

  // Strip Excel delimiter directive if present (e.g. sep=; or sep=,)
  cleanContent = cleanContent.replace(/^sep=[;,]\r?\n/i, '').trim();
  if (!cleanContent) return [];

  const parsed = Papa.parse<Record<string, any>>(cleanContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  const leads: ParsedLead[] = [];

  for (const row of parsed.data) {
    const name = String(row.name || row.Nome || row.title || row.empresa || '').trim();
    const phone = String(row.phone || row.Telefone || row.telefone || row.celular || '').trim();
    if (!name && !phone) continue;

    const normalized_phone = row.normalized_phone
      ? normalizePhone(String(row.normalized_phone))
      : normalizePhone(phone);

    const rawWebsite = row.website ? String(row.website).trim() : '';
    const hasWebsiteExplicit =
      row.has_website === 'true' ||
      row.has_website === true ||
      row.has_website === '1' ||
      row.has_website === 1;

    const website = rawWebsite && rawWebsite !== 'null' && rawWebsite !== 'undefined' ? rawWebsite : null;
    const has_website = hasWebsiteExplicit || Boolean(website) ? 1 : 0;

    const nicho = String(row.nicho || row.Nicho || row.categoria || row.category || 'Geral').trim();
    const location = row.location || row.Cidade || row.cidade || row.endereco ? String(row.location || row.Cidade || row.cidade || row.endereco).trim() : null;

    const rating = row.rating ? parseFloat(String(row.rating)) : null;
    const reviews_count = row.reviews_count ? parseInt(String(row.reviews_count), 10) : null;
    const google_maps_url = row.google_maps_url ? String(row.google_maps_url).trim() : null;

    leads.push({
      name,
      phone,
      normalized_phone,
      has_website,
      website,
      nicho,
      location,
      rating: isNaN(rating as number) ? null : rating,
      reviews_count: isNaN(reviews_count as number) ? null : reviews_count,
      google_maps_url,
    });
  }

  return leads;
}
