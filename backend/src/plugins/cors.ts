import fp from 'fastify-plugin'
import cors from '@fastify/cors'
import { env } from '../config/env'

export default fp(async (fastify) => {
  const origins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())

  await fastify.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true) // server-to-server
      const allowed =
        origins.some((o) => {
          if (o.includes('*')) {
            // wildcard subdomain match
            const pattern = new RegExp('^' + o.replace(/\*/g, '[^.]+') + '$')
            return pattern.test(origin)
          }
          return o === origin
        }) || env.NODE_ENV === 'development'
      cb(null, allowed)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'version', 'x-restaurant-slug'],
  })
})
