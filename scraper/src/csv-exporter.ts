import fs from 'node:fs';
import path from 'node:path';
import type { ScrapedLead } from './types.js';

function escapeCsvField(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exports scraped leads to a CSV file encoded in UTF-8 (with BOM for Excel compatibility).
 */
export async function exportLeadsToCsv(
  leads: ScrapedLead[],
  outputPath?: string
): Promise<string> {
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
    escapeCsvField(lead.name),
    escapeCsvField(lead.phone),
    escapeCsvField(lead.normalizedPhone),
    escapeCsvField(lead.nicho),
    escapeCsvField(lead.hasWebsite),
    escapeCsvField(lead.website),
    escapeCsvField(lead.location),
    escapeCsvField(lead.rating),
    escapeCsvField(lead.reviewsCount),
    escapeCsvField(lead.googleMapsUrl),
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n') + '\n';

  await fs.promises.writeFile(finalPath, csvContent, 'utf-8');

  return finalPath;
}
