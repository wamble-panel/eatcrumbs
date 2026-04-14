'use client'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function getSlug(): string {
  if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_FRANCHISE_SLUG ?? ''
  const host = window.location.hostname
  if (host.endsWith('.prepit.app')) {
    const parts = host.split('.')
    const slug = parts[0]
    if (slug && !['api', 'admin', 'www'].includes(slug)) return slug
  }
  return process.env.NEXT_PUBLIC_FRANCHISE_SLUG ?? ''
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('sf_token')
}

export function setToken(token: string): void {
  localStorage.setItem('sf_token', token)
}

export function clearToken(): void {
  localStorage.removeItem('sf_token')
}

export function getStoredToken(): string | null {
  return getToken()
}

function buildHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  const slug = getSlug()
  if (slug) h['x-franchise-slug'] = slug
  const token = getToken()
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: buildHeaders(),
    credentials: 'include',
  })
  return handleResponse<T>(res)
}

export async function apiPost<T>(path: string, data?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: buildHeaders(),
    credentials: 'include',
    body: data !== undefined ? JSON.stringify(data) : undefined,
  })
  return handleResponse<T>(res)
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: buildHeaders(),
    credentials: 'include',
  })
  return handleResponse<T>(res)
}
