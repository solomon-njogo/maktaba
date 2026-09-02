import { NextResponse } from "next/server"

const API_URL = process.env.API_URL ?? "http://localhost:5000"

export async function proxyToApi(
  path: string,
  init?: RequestInit
): Promise<NextResponse> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
      cache: "no-store",
    })

    const text = await response.text()
    const body = text ? JSON.parse(text) : null
    return NextResponse.json(body, { status: response.status })
  } catch (error) {
    console.error(`BFF proxy error [${path}]:`, error)
    return NextResponse.json(
      { error: "Library API is unavailable." },
      { status: 502 }
    )
  }
}
