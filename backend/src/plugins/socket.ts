import fp from 'fastify-plugin'
import { Server as SocketServer } from 'socket.io'
import { verifyToken, isAdminPayload, isCustomerPayload } from '../lib/jwt'
import { env } from '../config/env'

declare module 'fastify' {
  interface FastifyInstance {
    io: SocketServer
  }
}

export default fp(async (fastify) => {
  const origins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())

  const io = new SocketServer(fastify.server, {
    cors: {
      origin: env.NODE_ENV === 'development' ? '*' : origins,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  })

  // ── /socket/restaurant ────────────────────────────────────────────────────
  const restaurantNs = io.of('/socket/restaurant')
  restaurantNs.use((socket, next) => {
    try {
      const { token, restaurantId } = socket.handshake.query as Record<string, string>
      if (!token || !restaurantId) return next(new Error('Missing auth'))
      const payload = verifyToken(token)
      if (!isCustomerPayload(payload)) return next(new Error('Invalid token'))
      socket.data.restaurantId = Number(restaurantId)
      socket.data.customerId = payload.customer_id
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })
  restaurantNs.on('connection', (socket) => {
    const rid = socket.data.restaurantId
    socket.join(`restaurant:${rid}`)
    socket.join(`customer:${socket.data.customerId}`)
  })

  // ── /socket/franchise ─────────────────────────────────────────────────────
  const franchiseNs = io.of('/socket/franchise')
  franchiseNs.use((socket, next) => {
    try {
      const { token, franchiseId } = socket.handshake.query as Record<string, string>
      if (!token || !franchiseId) return next(new Error('Missing auth'))
      const payload = verifyToken(token)
      if (!isCustomerPayload(payload)) return next(new Error('Invalid token'))
      socket.data.franchiseId = Number(franchiseId)
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })
  franchiseNs.on('connection', (socket) => {
    socket.join(`franchise:${socket.data.franchiseId}`)
  })

  // ── /socket/waiter ────────────────────────────────────────────────────────
  const waiterNs = io.of('/socket/waiter')
  waiterNs.use((socket, next) => {
    try {
      const { token } = socket.handshake.query as Record<string, string>
      if (!token) return next(new Error('Missing auth'))
      verifyToken(token)
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  // ── /socket/admin ─────────────────────────────────────────────────────────
  const adminNs = io.of('/socket/admin')
  adminNs.use((socket, next) => {
    try {
      const { token, adminId } = socket.handshake.query as Record<string, string>
      if (!token || !adminId) return next(new Error('Missing auth'))
      const payload = verifyToken(token)
      if (!isAdminPayload(payload)) return next(new Error('Invalid token'))
      socket.data.adminId = adminId
      socket.data.restaurantId = payload.restaurant_id
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })
  adminNs.on('connection', (socket) => {
    socket.join(`admin:${socket.data.restaurantId}`)
  })

  fastify.decorate('io', io)
})
