export function cleanIsbnString(isbn: string): string {
  return isbn.replace(/[-\s]/g, "")
}
