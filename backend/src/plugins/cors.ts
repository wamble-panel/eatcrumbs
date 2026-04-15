import fp from 'fastify-plugin'
import cors from '@fastify/cors'
import { env } from '../config/env'

/**
 * Escape all regex metacharacters in a string segment so they are treated
 * as literals. Does NOT escape '*' — those are handled separately (split first).
 */
function escapeRegexSegment(s: string): string {
  return s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Build a safe RegExp from an allowed-origin pattern that may contain
 * at most one '*' wildcard (e.g. "https://*.prepit.app").
 * The wildcard matches exactly one subdomain label ([^.]+), nothing more.
 */
function buildOriginPattern(pattern: string): RegExp {
  const escaped = pattern.split('*').map(escapeRegexSegment).join('[^.]+')
  return new RegExp('^' + escaped + '$')
}

export default fp(async (fastify) => {
  const rawOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)

  // Pre-compile wildcard patterns once at startup
  const wildcardPatterns: RegExp[] = []
  const exactOrigins = new Set<string>()

  for (const o of rawOrigins) {
    if (o.includes('*')) {
      wildcardPatterns.push(buildOriginPattern(o))
    } else {
      exactOrigins.add(o)
    }
  }

  await fastify.register(cors, {
    origin: (origin, cb) => {
      // Allow server-to-server requests (no Origin header)
      if (!origin) return cb(null, true)

      const allowed =
        exactOrigins.has(origin) ||
        wildcardPatterns.some((re) => re.test(origin))

      cb(null, allowed)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'version', 'x-restaurant-slug', 'x-franchise-slug'],
  })
})
