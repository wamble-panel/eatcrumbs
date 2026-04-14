import { headers } from 'next/headers'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function getSlugFromHeaders(): string {
  const h = headers()
  const host = h.get('host') ?? ''
  // In production: {slug}.prepit.app
  if (host.endsWith('.prepit.app')) {
    const parts = host.split('.')
    const slug = parts[0]
    if (slug && !['api', 'admin', 'www'].includes(slug)) return slug
  }
  return process.env.NEXT_PUBLIC_FRANCHISE_SLUG ?? ''
}

export async function serverGet<T>(path: string, opts?: RequestInit): Promise<T> {
  const slug = getSlugFromHeaders()
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(slug ? { 'x-franchise-slug': slug } : {}),
      ...(opts?.headers as Record<string, string> | undefined),
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `API ${res.status}`)
  }
  return res.json() as Promise<T>
}
