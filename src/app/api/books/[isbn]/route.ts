import { proxyToApi } from "@/lib/api/proxy"

type BookContext = { params: Promise<{ isbn: string }> }

export async function GET(_request: Request, context: BookContext) {
  const { isbn } = await context.params
  return proxyToApi(`/api/books/${encodeURIComponent(isbn)}`)
}

export async function PATCH(request: Request, context: BookContext) {
  const { isbn } = await context.params
  const body = await request.text()
  return proxyToApi(`/api/books/${encodeURIComponent(isbn)}`, {
    method: "PATCH",
    body,
  })
}

export async function DELETE(_request: Request, context: BookContext) {
  const { isbn } = await context.params
  return proxyToApi(`/api/books/${encodeURIComponent(isbn)}`, {
    method: "DELETE",
  })
}
