import type { FastifyRequest, FastifyReply } from 'fastify'
import { verifyToken, isAdminPayload, isCustomerPayload } from '../lib/jwt'
import { UnauthorizedError, ForbiddenError } from '../lib/errors'

function extractToken(req: FastifyRequest): string | null {
  const auth = req.headers.authorization
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  const cookies = req.headers.cookie
  if (cookies) {
    const adminMatch = cookies.match(/admin-token=([^;]+)/)
    if (adminMatch) return adminMatch[1]
    const tokenMatch = cookies.match(/\bTOKEN=([^;]+)/)
    if (tokenMatch) return tokenMatch[1]
  }
  return null
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const token = extractToken(req)
  if (!token) throw new UnauthorizedError()
  try {
    const payload = verifyToken(token)
    if (!isAdminPayload(payload)) throw new UnauthorizedError()
    // Enforce tenant: restaurantId must match token
    if (req.restaurantId && req.restaurantId !== payload.restaurant_id) {
      throw new ForbiddenError()
    }
    req.admin = payload
    req.restaurantId = payload.restaurant_id
  } catch (err: any) {
    if (err instanceof ForbiddenError) throw err
    throw new UnauthorizedError()
  }
}

export async function requireCustomer(req: FastifyRequest, reply: FastifyReply) {
  const token = extractToken(req)
  if (!token) throw new UnauthorizedError()
  try {
    const payload = verifyToken(token)
    if (!isCustomerPayload(payload)) throw new UnauthorizedError()
    req.customer = payload
    if (!req.restaurantId) req.restaurantId = payload.restaurant_id
  } catch (err: any) {
    if (err instanceof ForbiddenError) throw err
    throw new UnauthorizedError()
  }
}

export async function optionalCustomer(req: FastifyRequest, _reply: FastifyReply) {
  const token = extractToken(req)
  if (!token) return
  try {
    const payload = verifyToken(token)
    if (isCustomerPayload(payload)) {
      req.customer = payload
      if (!req.restaurantId) req.restaurantId = payload.restaurant_id
    }
  } catch {
    // ignore — optional auth
  }
}
