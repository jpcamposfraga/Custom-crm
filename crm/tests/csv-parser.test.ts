import { describe, it, expect } from 'vitest';
import { parseCsv } from '../src/lib/csv-parser';

describe('parseCsv', () => {
  it('parses semicolon-delimited CSV (new Excel format)', () => {
    const csv = `name;phone;normalized_phone;nicho;has_website;website;location;rating;reviews_count;google_maps_url\r\n` +
      `Clínica Sorriso;(19) 98765-4321;19987654321;Dentista;true;https://sorriso.com;Campinas, SP;4.9;50;https://maps.google.com/1`;

    const leads = parseCsv(csv);
    expect(leads).toHaveLength(1);
    expect(leads[0].name).toBe('Clínica Sorriso');
    expect(leads[0].phone).toBe('(19) 98765-4321');
    expect(leads[0].normalized_phone).toBe('19987654321');
    expect(leads[0].nicho).toBe('Dentista');
    expect(leads[0].has_website).toBe(1);
    expect(leads[0].rating).toBe(4.9);
  });

  it('parses comma-delimited CSV (legacy format)', () => {
    const csv = `name,phone,normalized_phone,nicho,has_website,website,location,rating,reviews_count,google_maps_url\n` +
      `Auto Peças,(11) 3333-4444,1133334444,Mecânica,false,,,4.5,10,`;

    const leads = parseCsv(csv);
    expect(leads).toHaveLength(1);
    expect(leads[0].name).toBe('Auto Peças');
    expect(leads[0].normalized_phone).toBe('1133334444');
    expect(leads[0].has_website).toBe(0);
  });

  it('strips sep=; directive header if present', () => {
    const csv = `sep=;\r\n` +
      `name;phone;normalized_phone;nicho;has_website;website;location\r\n` +
      `Padaria Central;(11) 91234-5678;11912345678;Alimentos;false;;Centro`;

    const leads = parseCsv(csv);
    expect(leads).toHaveLength(1);
    expect(leads[0].name).toBe('Padaria Central');
    expect(leads[0].normalized_phone).toBe('11912345678');
  });
});
