import type { PhoneNormalizationResult } from './types.js';

const VALID_DDDS = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '21', '22', '24', '27', '28',
  '31', '32', '33', '34', '35', '37', '38',
  '41', '42', '43', '44', '45', '46', '47', '48', '49',
  '51', '53', '54', '55',
  '61', '62', '63', '64', '65', '66', '67', '68', '69',
  '71', '73', '74', '75', '77', '79',
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
  '91', '92', '93', '94', '95', '96', '97', '98', '99',
]);

/**
 * Normalizes and validates Brazilian phone numbers.
 * Supports landlines (10 digits) and mobiles (11 digits), handling +55 and leading 0.
 */
export function normalizePhone(rawPhone: string | undefined | null): PhoneNormalizationResult {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return {
      normalized: '',
      formatted: '',
      isValid: false,
    };
  }

  let digits = rawPhone.replace(/\D/g, '');

  if (!digits) {
    return {
      normalized: '',
      formatted: '',
      isValid: false,
    };
  }

  // Remove Brazilian country code 55 if present and length indicates full number
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2);
  }

  // Remove leading carrier prefix / 0 if present (e.g. 011987654321)
  if (digits.startsWith('0') && (digits.length === 11 || digits.length === 12)) {
    digits = digits.slice(1);
  }

  const ddd = digits.slice(0, 2);
  const isValidDdd = VALID_DDDS.has(ddd);

  // Brazilian Mobile: 11 digits, starts with 9 after DDD
  if (digits.length === 11 && isValidDdd && digits[2] === '9') {
    return {
      normalized: digits,
      formatted: `(${ddd}) ${digits.slice(2, 7)}-${digits.slice(7)}`,
      isValid: true,
    };
  }

  // Brazilian Landline: 10 digits
  if (digits.length === 10 && isValidDdd) {
    return {
      normalized: digits,
      formatted: `(${ddd}) ${digits.slice(2, 6)}-${digits.slice(6)}`,
      isValid: true,
    };
  }

  return {
    normalized: digits,
    formatted: digits,
    isValid: false,
  };
}
