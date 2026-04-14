import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import type { AdminJwtPayload, CustomerJwtPayload } from '../types'

export function signAdminToken(payload: AdminJwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as any })
}

export function signCustomerToken(payload: CustomerJwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_CUSTOMER_EXPIRES_IN as any,
  })
}

export function verifyToken(token: string): AdminJwtPayload | CustomerJwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as AdminJwtPayload | CustomerJwtPayload
}

export function isAdminPayload(p: any): p is AdminJwtPayload {
  return typeof p === 'object' && p !== null && 'admin_id' in p
}

export function isCustomerPayload(p: any): p is CustomerJwtPayload {
  return typeof p === 'object' && p !== null && 'customer_id' in p
}
