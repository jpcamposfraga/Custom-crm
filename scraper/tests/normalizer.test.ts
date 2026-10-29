import { describe, it, expect } from 'vitest';
import { normalizePhone } from '../src/normalizer.js';

describe('normalizePhone', () => {
  it('normalizes standard 11-digit mobile phone with masks', () => {
    const res = normalizePhone('(11) 98765-4321');
    expect(res).toEqual({
      normalized: '11987654321',
      formatted: '(11) 98765-4321',
      isValid: true,
    });
  });

  it('normalizes phone with Brazilian country code +55', () => {
    const res = normalizePhone('+55 (19) 3234-5678');
    expect(res).toEqual({
      normalized: '1932345678',
      formatted: '(19) 3234-5678',
      isValid: true,
    });
  });

  it('normalizes 13-digit raw string with country code 55 and mobile 9', () => {
    const res = normalizePhone('5511999998888');
    expect(res).toEqual({
      normalized: '11999998888',
      formatted: '(11) 99999-8888',
      isValid: true,
    });
  });

  it('normalizes phone with leading zero before DDD', () => {
    const res = normalizePhone('011987654321');
    expect(res).toEqual({
      normalized: '11987654321',
      formatted: '(11) 98765-4321',
      isValid: true,
    });
  });

  it('handles empty or undefined phone strings gracefully', () => {
    expect(normalizePhone('')).toEqual({
      normalized: '',
      formatted: '',
      isValid: false,
    });
    expect(normalizePhone(undefined)).toEqual({
      normalized: '',
      formatted: '',
      isValid: false,
    });
    expect(normalizePhone(null)).toEqual({
      normalized: '',
      formatted: '',
      isValid: false,
    });
  });

  it('marks invalid short or malformed numbers as isValid: false', () => {
    const res = normalizePhone('1234-567');
    expect(res.isValid).toBe(false);
    expect(res.normalized).toBe('1234567');
  });

  it('validates DDD range properly', () => {
    // DDD 05 does not exist
    const res = normalizePhone('05987654321');
    expect(res.isValid).toBe(false);
  });
});
