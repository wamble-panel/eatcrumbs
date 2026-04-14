import type { FastifyRequest, FastifyReply } from 'fastify'
import { supabase } from '../config/supabase'

// In-memory caches (TTL 5 min) — replace with Redis in production
const slugCache = new Map<string, { id: number; expiresAt: number }>()
const domainCache = new Map<string, { id: number; expiresAt: number }>()
const CACHE_TTL = 5 * 60 * 1000

async function resolveSlug(slug: string): Promise<number | null> {
  const cached = slugCache.get(slug)
  if (cached && Date.now() < cached.expiresAt) return cached.id

  const { data } = await supabase
    .from('franchises')
    .select('restaurant_id')
    .eq('slug', slug)
    .single()

  if (!data) return null

  slugCache.set(slug, { id: data.restaurant_id, expiresAt: Date.now() + CACHE_TTL })
  return data.restaurant_id
}

async function resolveCustomDomain(host: string): Promise<number | null> {
  const cached = domainCache.get(host)
  if (cached && Date.now() < cached.expiresAt) return cached.id

  const { data } = await supabase
    .from('custom_domains')
    .select('restaurant_id')
    .eq('domain', host)
    .eq('is_verified', true)
    .single()

  if (!data) return null

  domainCache.set(host, { id: data.restaurant_id, expiresAt: Date.now() + CACHE_TTL })
  return data.restaurant_id
}

function extractHostFromOrigin(origin?: string): string | null {
  if (!origin) return null
  try {
    return new URL(origin).hostname
  } catch {
    return null
  }
}

function extractSubdomainSlug(host: string): string | null {
  if (!host.endsWith('.prepit.app')) return null
  const parts = host.split('.')
  const slug = parts[0]
  if (!slug || slug === 'admin' || slug === 'api' || slug === 'www') return null
  return slug
}

/** Sets req.restaurantId from (in priority order):
 *  1. x-restaurant-slug / x-franchise-slug header
 *  2. Origin `*.prepit.app` subdomain
 *  3. Origin matched against a verified custom_domains row
 *  4. Falls back to 0 — route handlers guard with explicit restaurantId.
 */
export async function resolveTenant(req: FastifyRequest, _reply: FastifyReply) {
  // Header takes priority (used by admin dashboard and explicit API calls)
  const headerSlug =
    (req.headers['x-restaurant-slug'] as string) || (req.headers['x-franchise-slug'] as string)
  if (headerSlug) {
    const id = await resolveSlug(headerSlug)
    if (id) {
      req.restaurantId = id
      return
    }
  }

  const origin = req.headers.origin || req.headers.referer
  const host = extractHostFromOrigin(origin)
  if (host) {
    // Try the *.prepit.app subdomain pattern first
    const slug = extractSubdomainSlug(host)
    if (slug) {
      const id = await resolveSlug(slug)
      if (id) {
        req.restaurantId = id
        return
      }
    }

    // Fall back to a verified custom domain (e.g. "order.brand.com")
    const id = await resolveCustomDomain(host)
    if (id) {
      req.restaurantId = id
      return
    }
  }

  // No tenant resolved — individual routes can still enforce via body/query params
  req.restaurantId = 0
}
