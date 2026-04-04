export type IsbnValidation =
  | { ok: true; normalized: string; kind: 'isbn10' | 'isbn13' }
  | { ok: false; reason: 'empty' | 'too_short' | 'not_isbn' | 'invalid_checksum' };

function stripIsbnCandidate(input: string) {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^0-9X]/g, '');
}

export function normalizeIsbnCandidate(input: string) {
  const stripped = stripIsbnCandidate(input);
  if (!stripped) return null;

  // UPC-A 12 digits sometimes appears; normalize to EAN-13 by prefixing 0.
  if (/^\d{12}$/.test(stripped)) return `0${stripped}`;

  if (/^\d{13}$/.test(stripped)) return stripped;
  if (/^\d{9}[0-9X]$/.test(stripped)) return stripped;

  return null;
}

export function validateIsbnCandidate(input: string): IsbnValidation {
  const normalized = normalizeIsbnCandidate(input);
  if (!input.trim()) return { ok: false, reason: 'empty' };
  if (!normalized) {
    const stripped = stripIsbnCandidate(input);
    if (stripped.length > 0 && stripped.length < 10) return { ok: false, reason: 'too_short' };
    return { ok: false, reason: 'not_isbn' };
  }

  if (/^\d{9}[0-9X]$/.test(normalized)) {
    return isValidIsbn10(normalized)
      ? { ok: true, normalized, kind: 'isbn10' }
      : { ok: false, reason: 'invalid_checksum' };
  }

  if (/^\d{13}$/.test(normalized)) {
    return isValidIsbn13(normalized)
      ? { ok: true, normalized, kind: 'isbn13' }
      : { ok: false, reason: 'invalid_checksum' };
  }

  return { ok: false, reason: 'not_isbn' };
}

export function barcodeToIsbnCandidate(input: string) {
  const digits = input.replace(/\D/g, '');
  if (!digits) return null;

  // Common cases: EAN-13 (13 digits), UPC-A (12 digits)
  if (digits.length === 12) return `0${digits}`;
  if (digits.length === 13) return digits;

  // Sometimes scanners return extra leading zeros or embedded formatting; try to salvage.
  if (digits.length > 13) {
    const last13 = digits.slice(-13);
    if (/^\d{13}$/.test(last13)) return last13;
  }

  return null;
}

function isValidIsbn10(isbn10: string) {
  if (!/^\d{9}[0-9X]$/.test(isbn10)) return false;
  const sum = isbn10
    .split('')
    .map((ch, idx) => {
      const val = ch === 'X' ? 10 : Number(ch);
      return val * (10 - idx);
    })
    .reduce((a, b) => a + b, 0);
  return sum % 11 === 0;
}

function isValidIsbn13(isbn13: string) {
  if (!/^\d{13}$/.test(isbn13)) return false;
  const sum = isbn13
    .slice(0, 12)
    .split('')
    .map((ch, idx) => Number(ch) * (idx % 2 === 0 ? 1 : 3))
    .reduce((a, b) => a + b, 0);
  const check = (10 - (sum % 10)) % 10;
  return check === Number(isbn13[12]);
}
