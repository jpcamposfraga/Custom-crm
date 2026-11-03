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

export function normalizeRawLead(raw: Record<string, any>): ParsedLead {
  if (!raw || typeof raw !== 'object') {
    return {
      name: '',
      phone: '',
      normalized_phone: '',
      has_website: 0,
      website: null,
      nicho: 'Geral',
      location: null,
      rating: null,
      reviews_count: null,
      google_maps_url: null,
    };
  }

  const name = String(raw.name || raw.Nome || raw.nome || raw.title || raw.empresa || raw.Empresa || '').trim();
  const phone = String(raw.phone || raw.Telefone || raw.telefone || raw.celular || raw.Celular || '').trim();

  const rawNormPhone = raw.normalized_phone ?? raw.normalizedPhone;
  const normalized_phone = rawNormPhone
    ? normalizePhone(String(rawNormPhone))
    : normalizePhone(phone);

  const rawWebsite = raw.website ?? raw.Website ?? raw.site ?? raw.Site ?? '';
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
  const rawLocation = raw.location ?? raw.Location ?? raw.Cidade ?? raw.cidade ?? raw.endereco ?? raw.Endereco;
  const location = rawLocation ? String(rawLocation).trim() : null;

  // Nullish coalescing so numeric 0 is preserved
  const rawRating = raw.rating ?? raw.Rating ?? raw.avaliacao ?? raw.Avaliacao ?? raw.Avaliação;
  const ratingNum =
    rawRating !== undefined && rawRating !== null && rawRating !== ''
      ? parseFloat(String(rawRating).replace(',', '.'))
      : null;
  const rating = ratingNum !== null && !isNaN(ratingNum) ? ratingNum : null;

  const rawReviews =
    raw.reviews_count ?? raw.reviewsCount ?? raw.ReviewsCount ?? raw.avaliacoes ?? raw.Avaliacoes;
  const reviewsNum =
    rawReviews !== undefined && rawReviews !== null && rawReviews !== ''
      ? parseInt(String(rawReviews), 10)
      : null;
  const reviews_count = reviewsNum !== null && !isNaN(reviewsNum) ? reviewsNum : null;

  const rawGoogleMapsUrl =
    raw.google_maps_url ?? raw.googleMapsUrl ?? raw.GoogleMapsUrl ?? raw.maps_url ?? raw.mapsUrl;
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

export function parseCsv(csvContent: string): ParsedLead[] {
  let cleanContent = csvContent.replace(/^\uFEFF/, '').trim();
  if (!cleanContent) return [];

  // Extract explicit delimiter directive if present (e.g. sep=; or sep=,)
  const sepMatch = cleanContent.match(/^sep=([;,|\t])\r?\n/i);
  let delimiter: string | undefined = undefined;
  if (sepMatch) {
    delimiter = sepMatch[1];
    cleanContent = cleanContent.replace(/^sep=[;,|\t]\r?\n/i, '').trim();
  } else {
    // Explicitly detect delimiter based on header line
    const firstLine = cleanContent.split(/\r?\n/)[0] || '';
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;

    if (semicolonCount > commaCount && semicolonCount > tabCount) {
      delimiter = ';';
    } else if (commaCount > semicolonCount && commaCount > tabCount) {
      delimiter = ',';
    } else if (tabCount > semicolonCount && tabCount > commaCount) {
      delimiter = '\t';
    }
  }

  const parsed = Papa.parse<Record<string, any>>(cleanContent, {
    header: true,
    skipEmptyLines: true,
    delimiter,
    transformHeader: (header) => header.trim(),
  });

  const leads: ParsedLead[] = [];

  for (const row of parsed.data) {
    const lead = normalizeRawLead(row);
    if (!lead.name && !lead.phone) continue;
    leads.push(lead);
  }

  return leads;
}
