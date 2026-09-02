import { proxyToApi } from "@/lib/api/proxy"

export async function GET(request: Request) {
  const { search } = new URL(request.url)
  return proxyToApi(`/api/books${search}`)
}

export async function POST(request: Request) {
  const body = await request.text()
  return proxyToApi("/api/books", {
    method: "POST",
    body,
  })
}
