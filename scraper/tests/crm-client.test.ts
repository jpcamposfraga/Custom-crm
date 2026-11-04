import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { syncLeadsToCrm } from '../src/crm-client.js';
import type { ScrapedLead } from '../src/types.js';

describe('Scraper CRM Client (Direct Sync)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const mockLeads: ScrapedLead[] = [
    {
      name: 'Dentista Alpha',
      phone: '(19) 98765-4321',
      normalizedPhone: '19987654321',
      nicho: 'Dentista',
      hasWebsite: true,
      website: 'https://alpha.com',
      location: 'Campinas, SP',
      rating: 4.9,
      reviewsCount: 30,
      googleMapsUrl: 'https://maps.google.com/alpha',
    },
  ];

  it('successfully sends leads to CRM API and returns parsed summary', async () => {
    const mockSummary = {
      totalReceived: 1,
      insertedCount: 1,
      duplicatesCount: 0,
      cardsCreated: 1,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, summary: mockSummary }),
    } as any);

    const result = await syncLeadsToCrm(mockLeads, { crmUrl: 'http://localhost:3000' });

    expect(result.success).toBe(true);
    expect(result.offline).toBe(false);
    expect(result.summary).toEqual(mockSummary);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/leads/import',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: mockLeads }),
      })
    );
  });

  it('gracefully detects offline CRM (ECONNREFUSED) without crashing', async () => {
    const connRefusedErr = new Error('fetch failed');
    (connRefusedErr as any).cause = { code: 'ECONNREFUSED' };

    globalThis.fetch = vi.fn().mockRejectedValue(connRefusedErr);

    const result = await syncLeadsToCrm(mockLeads, { crmUrl: 'http://localhost:3000' });

    expect(result.success).toBe(false);
    expect(result.offline).toBe(true);
    expect(result.error).toContain('offline');
  });

  it('distinguishes timeout (AbortError) from server offline', async () => {
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';

    globalThis.fetch = vi.fn().mockRejectedValue(abortErr);

    const result = await syncLeadsToCrm(mockLeads, { crmUrl: 'http://localhost:3000' });

    expect(result.success).toBe(false);
    expect(result.offline).toBe(false);
    expect(result.error).toContain('Tempo limite');
  });

  it('handles non-200 responses from CRM API', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid payload' }),
    } as any);

    const result = await syncLeadsToCrm(mockLeads, { crmUrl: 'http://localhost:3000' });

    expect(result.success).toBe(false);
    expect(result.offline).toBe(false);
    expect(result.error).toContain('Invalid payload');
  });

  it('returns early when leads array is empty without calling fetch', async () => {
    globalThis.fetch = vi.fn();

    const result = await syncLeadsToCrm([]);

    expect(result.success).toBe(true);
    expect(result.summary?.totalReceived).toBe(0);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('automatically discovers active CRM port when port 3000 is down and port 3001 is active', async () => {
    const mockSummary = {
      totalReceived: 1,
      insertedCount: 1,
      duplicatesCount: 0,
      cardsCreated: 1,
    };

    globalThis.fetch = vi.fn().mockImplementation(async (url: string, opts?: any) => {
      // Probing port 3000 -> offline
      if (url.includes(':3000')) {
        const err = new Error('connect ECONNREFUSED 127.0.0.1:3000');
        (err as any).code = 'ECONNREFUSED';
        throw err;
      }
      // Probing port 3001 GET -> active
      if (url === 'http://localhost:3001/api/leads/import' && opts?.method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'ok', service: 'crm-leads-import' }),
        };
      }
      // Actual POST import to 3001
      if (url === 'http://localhost:3001/api/leads/import' && opts?.method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, summary: mockSummary }),
        };
      }
      throw new Error(`Unexpected url: ${url}`);
    });

    const result = await syncLeadsToCrm(mockLeads);

    expect(result.success).toBe(true);
    expect(result.resolvedUrl).toBe('http://localhost:3001');
    expect(result.summary).toEqual(mockSummary);
  });
});
