import type { AdminPayload } from '../types'

export type { AdminPayload }

const TOKEN_KEY = 'admin-token'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function decodeToken(token: string): AdminPayload | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64)) as AdminPayload
  } catch {
    return null
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeToken(token)
  if (!payload) return true
  const exp = (payload as AdminPayload & { exp?: number }).exp
  if (!exp) return false
  return Date.now() / 1000 > exp
}

export function getAdmin(): AdminPayload | null {
  const token = getToken()
  if (!token || isTokenExpired(token)) return null
  return decodeToken(token)
}
