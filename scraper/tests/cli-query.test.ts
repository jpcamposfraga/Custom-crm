import { describe, it, expect } from 'vitest';
import { buildSearchQuery } from '../src/query-builder.js';

describe('buildSearchQuery', () => {
  it('combines nicho and regiao with "em"', () => {
    const query = buildSearchQuery({ nicho: 'dentistas', regiao: 'Campinas, SP' });
    expect(query).toBe('dentistas em Campinas, SP');
  });

  it('uses busca directly if provided', () => {
    const query = buildSearchQuery({ busca: 'advogados em São Paulo', nicho: 'dentistas' });
    expect(query).toBe('advogados em São Paulo');
  });

  it('handles nicho alone', () => {
    const query = buildSearchQuery({ nicho: 'médicos' });
    expect(query).toBe('médicos');
  });

  it('handles regiao alone', () => {
    const query = buildSearchQuery({ regiao: 'Campinas, SP' });
    expect(query).toBe('Campinas, SP');
  });

  it('returns empty string if neither is provided', () => {
    const query = buildSearchQuery({});
    expect(query).toBe('');
  });
});
