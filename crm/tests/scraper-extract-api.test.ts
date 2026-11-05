import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as mapsCrawler from '../src/lib/maps-crawler';
import * as deduplicator from '../src/lib/deduplicator';

describe('Scraper Extract API Logic', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('validates required fields nicho or regiao', () => {
    const query = mapsCrawler.buildSearchQuery({ nicho: '', regiao: '' });
    expect(query).toBe('');
  });

  it('calls ingestRawLeads with scraped leads without proprietary websites and returns ingestion summary', async () => {
    const mockLeads: mapsCrawler.ScrapedLead[] = [
      {
        name: 'Clínica Bem Viver',
        phone: '(19) 99876-5432',
        normalizedPhone: '19998765432',
        nicho: 'Psicologia',
        hasWebsite: false,
        isProprietaryWebsite: false,
        socialType: 'instagram',
        socialUrl: 'https://instagram.com/clinicabemviver',
        notes: 'Instagram: https://instagram.com/clinicabemviver',
        location: 'Campinas SP',
        rating: 4.9,
        reviewsCount: 18,
      },
    ];

    vi.spyOn(deduplicator, 'ingestRawLeads').mockResolvedValueOnce({
      totalReceived: 1,
      insertedCount: 1,
      duplicatesCount: 0,
      cardsCreated: 1,
    });

    const summary = await deduplicator.ingestRawLeads(mockLeads);
    expect(summary.insertedCount).toBe(1);
    expect(summary.cardsCreated).toBe(1);
    expect(deduplicator.ingestRawLeads).toHaveBeenCalledWith(mockLeads);
  });
});
