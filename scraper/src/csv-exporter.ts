import fs from 'node:fs';
import path from 'node:path';
import type { ScrapedLead } from './types.js';

export interface CsvExportOptions {
  delimiter?: ';' | ',';
}

/**
 * Sanitizes text by removing line breaks (\r, \n), tabs, and duplicate spaces,
 * preventing multiline cells inside Excel.
 */
function sanitizeText(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value)
    .replace(/[\r\n\t]+/g, ' - ')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*-\s*/g, ' - ')
    .trim();
}

/**
 * Escapes a single CSV field value according to RFC 4180 rules.
 */
function escapeCsvField(value: unknown, delimiter = ';'): string {
  const sanitized = sanitizeText(value);
  if (
    sanitized.includes(delimiter) ||
    sanitized.includes('"') ||
    sanitized.includes(',')
  ) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

/**
 * Exports scraped leads to a CSV file encoded in UTF-8 (with BOM for Excel compatibility)
 * using semicolon (;) as default delimiter and CRLF (\r\n) line endings.
 */
export async function exportLeadsToCsv(
  leads: ScrapedLead[],
  outputPath?: string,
  options: CsvExportOptions = {}
): Promise<string> {
  const delimiter = options.delimiter || ';';
  let finalPath = outputPath;

  if (!finalPath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseDir = process.cwd().endsWith('scraper')
      ? process.cwd()
      : path.join(process.cwd(), 'scraper');
    finalPath = path.join(baseDir, 'output', `leads-${timestamp}.csv`);
  } else {
    finalPath = path.resolve(process.cwd(), finalPath);
  }

  await fs.promises.mkdir(path.dirname(finalPath), { recursive: true });

  const headers = [
    'name',
    'phone',
    'normalized_phone',
    'nicho',
    'has_website',
    'website',
    'location',
    'rating',
    'reviews_count',
    'google_maps_url',
  ];

  const rows = leads.map((lead) => [
    escapeCsvField(lead.name, delimiter),
    escapeCsvField(lead.phone, delimiter),
    escapeCsvField(lead.normalizedPhone, delimiter),
    escapeCsvField(lead.nicho, delimiter),
    escapeCsvField(lead.hasWebsite, delimiter),
    escapeCsvField(lead.website, delimiter),
    escapeCsvField(lead.location, delimiter),
    escapeCsvField(lead.rating, delimiter),
    escapeCsvField(lead.reviewsCount, delimiter),
    escapeCsvField(lead.googleMapsUrl, delimiter),
  ]);

  // UTF-8 BOM (\uFEFF) + headers + CRLF rows
  const csvContent =
    '\uFEFF' +
    [headers.join(delimiter), ...rows.map((r) => r.join(delimiter))].join('\r\n') +
    '\r\n';

  await fs.promises.writeFile(finalPath, csvContent, 'utf-8');

  return finalPath;
}
