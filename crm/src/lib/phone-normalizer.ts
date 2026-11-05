export interface PhoneNormalizationResult {
  normalized: string;
  formatted: string;
  isValid: boolean;
}

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
 * Normalizes Brazilian phone numbers (landline 10 digits, mobile 11 digits).
 */
export function normalizePhone(rawPhone?: string | null): PhoneNormalizationResult {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return { normalized: '', formatted: '', isValid: false };
  }

  let digits = rawPhone.replace(/\D/g, '');
  if (!digits) {
    return { normalized: '', formatted: '', isValid: false };
  }

  // Remove country code 55 if present
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2);
  }

  // Remove leading 0 if present (e.g. 011...)
  if (digits.startsWith('0') && (digits.length === 11 || digits.length === 12)) {
    digits = digits.slice(1);
  }

  const ddd = digits.slice(0, 2);
  const isValidDdd = VALID_DDDS.has(ddd);

  // Mobile: 11 digits, starts with 9
  if (digits.length === 11 && isValidDdd && digits[2] === '9') {
    return {
      normalized: digits,
      formatted: `(${ddd}) ${digits.slice(2, 7)}-${digits.slice(7)}`,
      isValid: true,
    };
  }

  // Landline: 10 digits
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
