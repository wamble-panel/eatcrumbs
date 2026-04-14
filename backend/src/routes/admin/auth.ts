import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { supabase } from '../../config/supabase'
import { signAdminToken } from '../../lib/jwt'
import { sendPasswordResetEmail } from '../../services/resend'
import { AppError, NotFoundError, UnauthorizedError } from '../../lib/errors'

const signInBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const forgotPasswordBody = z.object({
  email: z.string().email(),
})

const verifyResetTokenBody = z.object({
  token: z.string().min(1),
})

const resetPasswordBody = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
})

export default async function adminAuthRoutes(fastify: FastifyInstance) {
  // POST /signin  (also accepts /sign-in for legacy compat)
  const signInHandler = async (request: any, reply: any) => {
    const body = signInBody.parse(request.body)

    const { data: admin, error } = await supabase
      .from('admins')
      .select('id, restaurant_id, email, password_hash, role, is_active')
      .eq('email', body.email.toLowerCase())
      .single()

    if (error || !admin) throw new UnauthorizedError('Invalid email or password')
    if (!admin.is_active) throw new UnauthorizedError('Account is disabled')

    const valid = await bcrypt.compare(body.password, admin.password_hash)
    if (!valid) throw new UnauthorizedError('Invalid email or password')

    const token = signAdminToken({
      admin_id: admin.id,
      restaurant_id: admin.restaurant_id,
      role: admin.role,
      email: admin.email,
    })

    reply.setCookie('admin-token', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60,
    })

    return { token }
  }

  fastify.post('/signin', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, signInHandler)
  fastify.post('/sign-in', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, signInHandler)

  // POST /forgot-password
  fastify.post('/forgot-password', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { email } = forgotPasswordBody.parse(request.body)

    const { data: admin } = await supabase
      .from('admins')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .single()

    // Always return success to prevent email enumeration
    if (admin) {
      const token = crypto.randomBytes(32).toString('hex')
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
      const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      await supabase.from('admins').update({
        reset_token: tokenHash,
        reset_token_expires_at: expires.toISOString(),
      }).eq('id', admin.id)

      const resetLink = `${process.env.ADMIN_FRONTEND_URL || 'https://admin.prepit.app'}/resetpassword?token=${token}`
      await sendPasswordResetEmail(admin.email, resetLink).catch(console.error)
    }

    return { success: true }
  })

  // POST /verify-reset-password-token
  fastify.post('/verify-reset-password-token', async (request, reply) => {
    const { token } = verifyResetTokenBody.parse(request.body)
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    const { data: admin } = await supabase
      .from('admins')
      .select('id, reset_token_expires_at')
      .eq('reset_token', tokenHash)
      .single()

    if (!admin) throw new AppError(400, 'Invalid or expired reset token')
    if (new Date(admin.reset_token_expires_at) < new Date()) {
      throw new AppError(400, 'Reset token has expired')
    }

    return { valid: true }
  })

  // POST /reset-password
  fastify.post('/reset-password', async (request, reply) => {
    const { token, newPassword } = resetPasswordBody.parse(request.body)
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    const { data: admin } = await supabase
      .from('admins')
      .select('id, reset_token_expires_at')
      .eq('reset_token', tokenHash)
      .single()

    if (!admin) throw new AppError(400, 'Invalid or expired reset token')
    if (new Date(admin.reset_token_expires_at) < new Date()) {
      throw new AppError(400, 'Reset token has expired')
    }

    const hash = await bcrypt.hash(newPassword, 12)
    await supabase.from('admins').update({
      password_hash: hash,
      reset_token: null,
      reset_token_expires_at: null,
    }).eq('id', admin.id)

    return { success: true }
  })
}
