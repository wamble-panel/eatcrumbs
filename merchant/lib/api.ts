'use client'

import { getToken, clearToken } from './auth'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const ADMIN_PREFIX = '/admin/v2'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

function buildHeaders(contentType = 'application/json'): Record<string, string> {
  const h: Record<string, string> = {}
  if (contentType) h['Content-Type'] = contentType
  const token = getToken()
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    clearToken()
    if (typeof window !== 'undefined') window.location.href = '/login'
    throw new ApiError(401, 'Unauthorized')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export async function adminGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${ADMIN_PREFIX}${path}`, {
    headers: buildHeaders(),
    credentials: 'include',
  })
  return handleResponse<T>(res)
}

export async function adminPost<T>(path: string, data?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${ADMIN_PREFIX}${path}`, {
    method: 'POST',
    headers: buildHeaders(),
    credentials: 'include',
    body: data !== undefined ? JSON.stringify(data) : undefined,
  })
  return handleResponse<T>(res)
}

export async function adminPostForm<T>(path: string, form: FormData): Promise<T> {
  // Do NOT set Content-Type — let the browser set it with the boundary
  const token = getToken()
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}${ADMIN_PREFIX}${path}`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: form,
  })
  return handleResponse<T>(res)
}

// Auth (no ADMIN_PREFIX — auth routes are at the /admin/v2 prefix directly)
export async function adminSignIn(email: string, password: string): Promise<{ token: string }> {
  const res = await fetch(`${API_BASE}${ADMIN_PREFIX}/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  })
  return handleResponse<{ token: string }>(res)
}
