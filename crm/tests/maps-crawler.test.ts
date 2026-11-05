import { describe, it, expect } from 'vitest';
import { normalizePhone } from '../src/lib/phone-normalizer';
import { detectWebsiteType } from '../src/lib/website-detector';
import { buildSearchQuery } from '../src/lib/maps-crawler';

describe('Phone Normalizer', () => {
  it('normalizes valid 11-digit Brazilian mobile numbers with DDD', () => {
    const res = normalizePhone('(19) 98765-4321');
    expect(res.isValid).toBe(true);
    expect(res.normalized).toBe('19987654321');
    expect(res.formatted).toBe('(19) 98765-4321');
  });

  it('normalizes valid 10-digit Brazilian landline numbers', () => {
    const res = normalizePhone('+55 11 3456-7890');
    expect(res.isValid).toBe(true);
    expect(res.normalized).toBe('1134567890');
    expect(res.formatted).toBe('(11) 3456-7890');
  });

  it('handles invalid phone numbers gracefully', () => {
    const res = normalizePhone('1234');
    expect(res.isValid).toBe(false);
  });
});

describe('Website Classifier (Social / Biolink vs Proprietary Website)', () => {
  it('identifies Instagram links as NOT proprietary websites', () => {
    const res = detectWebsiteType('https://www.instagram.com/dra.psicologa');
    expect(res.isProprietary).toBe(false);
    expect(res.hasWebsite).toBe(false);
    expect(res.socialType).toBe('instagram');
    expect(res.socialUrl).toBe('https://www.instagram.com/dra.psicologa');
  });

  it('identifies WhatsApp links (wa.me) as NOT proprietary websites', () => {
    const res = detectWebsiteType('https://wa.me/5519999999999');
    expect(res.isProprietary).toBe(false);
    expect(res.hasWebsite).toBe(false);
    expect(res.socialType).toBe('whatsapp');
  });

  it('identifies Linktree / Beacons biolinks as NOT proprietary websites', () => {
    const res1 = detectWebsiteType('https://linktr.ee/clinicaviver');
    expect(res1.isProprietary).toBe(false);
    expect(res1.hasWebsite).toBe(false);
    expect(res1.socialType).toBe('biolink');

    const res2 = detectWebsiteType('https://beacons.ai/dra_maria');
    expect(res2.isProprietary).toBe(false);
    expect(res2.hasWebsite).toBe(false);
    expect(res2.socialType).toBe('biolink');
  });

  it('identifies real domain websites as proprietary', () => {
    const res = detectWebsiteType('https://clinicabemviver.com.br');
    expect(res.isProprietary).toBe(true);
    expect(res.hasWebsite).toBe(true);
    expect(res.url).toBe('https://clinicabemviver.com.br');
    expect(res.socialType).toBeUndefined();
  });

  it('handles empty or null website values', () => {
    const res = detectWebsiteType(null);
    expect(res.isProprietary).toBe(false);
    expect(res.hasWebsite).toBe(false);
    expect(res.url).toBeNull();
  });
});

describe('Search Query Builder', () => {
  it('builds query combining nicho and regiao with "em"', () => {
    const query = buildSearchQuery({ nicho: 'Psicólogas', regiao: 'Campinas SP' });
    expect(query).toBe('Psicólogas em Campinas SP');
  });

  it('handles empty regiao or nicho without extra spaces', () => {
    expect(buildSearchQuery({ nicho: 'Dentistas', regiao: '' })).toBe('Dentistas');
    expect(buildSearchQuery({ nicho: '', regiao: 'São Paulo' })).toBe('São Paulo');
  });
});
