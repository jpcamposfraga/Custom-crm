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

  it('parses semicolon-delimited CSV with multiple commas inside quotes and URLs without delimiter confusion', () => {
    const csv =
      'name;phone;normalized_phone;nicho;has_website;website;location;rating;reviews_count;google_maps_url\r\n' +
      '"Equilibrium - Psicologia, Consultoria Ltda.";(47) 3435-4455;4734354455;Psicólogo;false;;"R. Ricardo Landmann, 85/97 - Santo Antônio, Joinville - SC, 89218-200";5;4;"https://www.google.com/maps/place/data=!4m7!3m6!1s0x94deafe82fe6ce93,19sChIJk87mL"\r\n' +
      'Clínica Amanda;;;Psicólogo;false;;;;;https://maps.google.com/amanda\r\n' +
      'Psicóloga Rosane;(47) 99193-7199;47991937199;Psicólogo;false;;"R. Pres. Prudente, 1245, Joinville - SC";4.7;36;https://maps.google.com/rosane';

    const leads = parseCsv(csv);
    expect(leads).toHaveLength(3);
    expect(leads[0].name).toBe('Equilibrium - Psicologia, Consultoria Ltda.');
    expect(leads[0].phone).toBe('(47) 3435-4455');
    expect(leads[0].normalized_phone).toBe('4734354455');
    expect(leads[0].location).toContain('R. Ricardo Landmann, 85/97');
    expect(leads[1].name).toBe('Clínica Amanda');
    expect(leads[1].phone).toBe('');
    expect(leads[1].normalized_phone).toBe('');
    expect(leads[2].name).toBe('Psicóloga Rosane');
    expect(leads[2].phone).toBe('(47) 99193-7199');
  });

  it('handles Brazilian comma decimal ratings and alternative headers', () => {
    const csv =
      'Nome;Telefone;Nicho;Site;Endereco;Avaliação;avaliacoes\r\n' +
      'Dentista Central;(11) 98888-7777;Odonto;https://central.com;Rua das Flores, 10;4,8;25';

    const leads = parseCsv(csv);
    expect(leads).toHaveLength(1);
    expect(leads[0].name).toBe('Dentista Central');
    expect(leads[0].normalized_phone).toBe('11988887777');
    expect(leads[0].rating).toBe(4.8);
    expect(leads[0].reviews_count).toBe(25);
    expect(leads[0].has_website).toBe(1);
  });
});
