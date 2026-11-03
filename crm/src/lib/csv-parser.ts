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

  // Explicitly detect delimiter based on header line
  const firstLine = cleanContent.split(/\r?\n/)[0] || '';
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  let delimiter: string | undefined = undefined;
  if (semicolonCount > commaCount && semicolonCount > tabCount) {
    delimiter = ';';
  } else if (commaCount > semicolonCount && commaCount > tabCount) {
    delimiter = ',';
  } else if (tabCount > semicolonCount && tabCount > commaCount) {
    delimiter = '\t';
  }

  const parsed = Papa.parse<Record<string, any>>(cleanContent, {
    header: true,
    skipEmptyLines: true,
    delimiter,
    transformHeader: (header) => header.trim(),
  });

  const leads: ParsedLead[] = [];

  for (const row of parsed.data) {
    const name = String(row.name || row.Nome || row.nome || row.title || row.empresa || row.Empresa || '').trim();
    const phone = String(row.phone || row.Telefone || row.telefone || row.celular || row.Celular || '').trim();
    if (!name && !phone) continue;

    const normalized_phone = row.normalized_phone || row.normalizedPhone
      ? normalizePhone(String(row.normalized_phone || row.normalizedPhone))
      : normalizePhone(phone);

    const rawWebsite = row.website || row.Website || row.site || row.Site || '';
    const websiteStr = String(rawWebsite).trim();
    const hasWebsiteExplicit =
      row.has_website === 'true' ||
      row.has_website === true ||
      row.has_website === '1' ||
      row.has_website === 1 ||
      row.hasWebsite === true ||
      row.hasWebsite === 'true' ||
      row.hasWebsite === 1 ||
      row.hasWebsite === '1';

    const website = websiteStr && websiteStr !== 'null' && websiteStr !== 'undefined' ? websiteStr : null;
    const has_website = hasWebsiteExplicit || Boolean(website) ? 1 : 0;

    const nicho = String(row.nicho || row.Nicho || row.categoria || row.category || 'Geral').trim();
    const rawLocation = row.location || row.Location || row.Cidade || row.cidade || row.endereco || row.Endereco;
    const location = rawLocation ? String(rawLocation).trim() : null;

    const rawRating = row.rating || row.Rating || row.avaliacao || row.Avaliacao || row.Avaliação;
    const ratingNum = rawRating ? parseFloat(String(rawRating).replace(',', '.')) : null;
    const rating = ratingNum !== null && !isNaN(ratingNum) ? ratingNum : null;

    const rawReviews = row.reviews_count || row.reviewsCount || row.ReviewsCount || row.avaliacoes || row.Avaliacoes;
    const reviewsNum = rawReviews ? parseInt(String(rawReviews), 10) : null;
    const reviews_count = reviewsNum !== null && !isNaN(reviewsNum) ? reviewsNum : null;

    const rawGoogleMapsUrl = row.google_maps_url || row.googleMapsUrl || row.GoogleMapsUrl || row.maps_url || row.mapsUrl;
    const google_maps_url = rawGoogleMapsUrl ? String(rawGoogleMapsUrl).trim() : null;

    leads.push({
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
    });
  }

  return leads;
}
