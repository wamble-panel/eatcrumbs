import type { FastifyRequest, FastifyReply } from 'fastify'
import { supabase } from '../config/supabase'

// In-memory slug cache (TTL 5 min) — replace with Redis in production
const slugCache = new Map<string, { id: number; expiresAt: number }>()
const CACHE_TTL = 5 * 60 * 1000

async function resolveSlug(slug: string): Promise<number | null> {
  const cached = slugCache.get(slug)
  if (cached && Date.now() < cached.expiresAt) return cached.id

  const { data } = await supabase
    .from('franchises')
    .select('restaurant_id')
    .eq('slug', slug)
    .single()

  if (!data) {
    // try resolving as a direct restaurant slug
    const { data: r } = await supabase
      .from('restaurants')
      .select('id')
      .eq('slug', slug)
      .single()
    if (!r) return null
    slugCache.set(slug, { id: r.id, expiresAt: Date.now() + CACHE_TTL })
    return r.id
  }

  slugCache.set(slug, { id: data.restaurant_id, expiresAt: Date.now() + CACHE_TTL })
  return data.restaurant_id
}

function extractSlugFromOrigin(origin?: string): string | null {
  if (!origin) return null
  try {
    const url = new URL(origin)
    const host = url.hostname // e.g. "mybrand.prepit.app" or "mybrand.customdomain.com"
    if (host.endsWith('.prepit.app')) {
      const parts = host.split('.')
      const slug = parts[0]
      if (slug && slug !== 'admin' && slug !== 'api' && slug !== 'www') return slug
    }
    return null
  } catch {
    return null
  }
}

/** Sets req.restaurantId from:
 *  1. x-restaurant-slug header
 *  2. Origin subdomain
 *  3. Falls back to no-op (route handlers guard with explicit restaurantId)
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

  // Try to resolve from Origin subdomain
  const origin = req.headers.origin || req.headers.referer
  const slug = extractSlugFromOrigin(origin)
  if (slug) {
    const id = await resolveSlug(slug)
    if (id) {
      req.restaurantId = id
      return
    }
  }

  // No tenant resolved — individual routes can still enforce via body/query params
  req.restaurantId = 0
}
