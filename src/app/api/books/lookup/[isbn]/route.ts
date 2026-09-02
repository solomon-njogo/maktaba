import { proxyToApi } from "@/lib/api/proxy"

type LookupContext = { params: Promise<{ isbn: string }> }

export async function GET(_request: Request, context: LookupContext) {
  const { isbn } = await context.params
  return proxyToApi(`/api/books/lookup/${encodeURIComponent(isbn)}`)
}
