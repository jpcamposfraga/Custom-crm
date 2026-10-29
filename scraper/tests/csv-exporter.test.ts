import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { exportLeadsToCsv } from '../src/csv-exporter.js';
import type { ScrapedLead } from '../src/types.js';

describe('exportLeadsToCsv', () => {
  const testOutputDir = path.join(process.cwd(), 'scraper', 'test-output');

  afterEach(async () => {
    if (fs.existsSync(testOutputDir)) {
      await fs.promises.rm(testOutputDir, { recursive: true, force: true });
    }
  });

  it('exports leads to CSV with headers and proper escaping', async () => {
    const leads: ScrapedLead[] = [
      {
        name: 'Clínica Odonto, "Sorriso & Saúde"',
        phone: '(11) 98765-4321',
        normalizedPhone: '11987654321',
        nicho: 'dentista',
        hasWebsite: true,
        website: 'https://sorriso.com.br',
        location: 'Av. Paulista, 1000 - São Paulo, SP',
        rating: 4.8,
        reviewsCount: 120,
        googleMapsUrl: 'https://maps.google.com/?cid=123',
      },
      {
        name: 'Consultório Sem Site',
        phone: '(19) 3234-5678',
        normalizedPhone: '1932345678',
        nicho: 'dentista',
        hasWebsite: false,
        website: undefined,
        location: 'Campinas, SP',
        rating: undefined,
        reviewsCount: undefined,
        googleMapsUrl: undefined,
      },
    ];

    const targetFile = path.join(testOutputDir, 'leads-test.csv');
    const resultPath = await exportLeadsToCsv(leads, targetFile);

    expect(resultPath).toBe(targetFile);
    expect(fs.existsSync(targetFile)).toBe(true);

    const content = await fs.promises.readFile(targetFile, 'utf-8');
    const lines = content.replace(/^\uFEFF/, '').trim().split('\n');

    expect(lines[0]).toBe('name,phone,normalized_phone,nicho,has_website,website,location,rating,reviews_count,google_maps_url');
    // First lead with escaped commas and quotes
    expect(lines[1]).toContain('"Clínica Odonto, ""Sorriso & Saúde"""');
    expect(lines[1]).toContain('11987654321');
    expect(lines[1]).toContain('true');
    expect(lines[1]).toContain('4.8');
    expect(lines[1]).toContain('120');

    // Second lead without website or ratings
    expect(lines[2]).toContain('Consultório Sem Site');
    expect(lines[2]).toContain('1932345678');
    expect(lines[2]).toContain('false');
  });

  it('generates a default output file path when none is provided', async () => {
    const leads: ScrapedLead[] = [];
    const resultPath = await exportLeadsToCsv(leads);

    expect(fs.existsSync(resultPath)).toBe(true);
    expect(resultPath).toContain('leads-');
    expect(resultPath.endsWith('.csv')).toBe(true);

    // cleanup
    await fs.promises.unlink(resultPath);
  });
});
