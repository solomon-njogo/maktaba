export function cleanIsbnString(isbn: string): string {
  return isbn.replace(/[-\s]/g, "")
}

const ISBN_10 = /^[0-9]{9}[0-9Xx]$/
const ISBN_13 = /^[0-9]{13}$/

export function isCompleteIsbn(cleaned: string): boolean {
  if (cleaned.length === 10) return ISBN_10.test(cleaned)
  if (cleaned.length === 13) return ISBN_13.test(cleaned)
  return false
}

export function isLikelyIsbn13Prefix(cleaned: string): boolean {
  return cleaned.startsWith("978") || cleaned.startsWith("979")
}

/** ISBN-13, or ISBN-10 that is not a truncated 978/979 code. */
export function isLookupReadyIsbn(cleaned: string): boolean {
  if (!isCompleteIsbn(cleaned)) return false
  if (cleaned.length === 10 && isLikelyIsbn13Prefix(cleaned)) return false
  return true
}

export function parseIsbnList(raw: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(/[\s,;]+/)) {
    const cleaned = cleanIsbnString(part)
    if (!cleaned || seen.has(cleaned)) continue
    seen.add(cleaned)
    out.push(cleaned)
  }
  return out
}

export function isbnInputEndsWithSeparator(raw: string): boolean {
  return /[\s,;]$/.test(raw)
}

export function immediateLookupIsbns(raw: string): string[] {
  const tokens = parseIsbnList(raw)
  const lastCommitted = isbnInputEndsWithSeparator(raw)
  return tokens.filter((token, index) => {
    if (!isLookupReadyIsbn(token)) return false
    const isLast = index === tokens.length - 1
    // Debounce only a lone trailing ISBN-10 so typing 978… does not misfire at 10 digits.
    if (
      isLast &&
      !lastCommitted &&
      token.length === 10 &&
      tokens.length === 1
    ) {
      return false
    }
    return true
  })
}

export function debouncedIsbn10Candidate(raw: string): string | undefined {
  if (isbnInputEndsWithSeparator(raw)) return undefined
  const tokens = parseIsbnList(raw)
  if (tokens.length !== 1) return undefined
  const last = tokens[0]
  if (!last || last.length !== 10 || !isLookupReadyIsbn(last)) return undefined
  return last
}

/** Pull an ISBN from a barcode payload (EAN-13 Bookland, optional add-on). */
export function isbnFromBarcode(text: string): string | null {
  const digits = text.replace(/[^0-9Xx]/g, "").toUpperCase()
  if (digits.length >= 13) {
    const isbn13 = digits.slice(0, 13)
    if (isLookupReadyIsbn(isbn13)) return isbn13
  }
  if (digits.length === 10 && isLookupReadyIsbn(digits)) return digits
  return null
}

export function appendIsbnToInput(raw: string, isbn: string): string {
  const existing = parseIsbnList(raw)
  if (existing.includes(isbn)) return raw
  const trimmed = raw.trim()
  if (!trimmed) return isbn
  return `${trimmed}\n${isbn}`
}
