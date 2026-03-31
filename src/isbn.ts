/**
 * Normalizes an ISBN string by stripping hyphens and spaces,
 * then validates that it is either 10 or 13 digits.
 *
 * Returns the clean numeric string, or null if the input is invalid.
 */
export function normalizeIsbn(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-]/g, "");

  if (!/^\d{10}$/.test(cleaned) && !/^\d{13}$/.test(cleaned)) {
    return null;
  }

  return cleaned;
}
