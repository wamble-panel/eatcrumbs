import { Resend } from 'resend'
import { env } from '../config/env'

const client = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null

export async function sendPasswordResetEmail(to: string, resetLink: string) {
  if (!client) {
    console.log(`[Email STUB] Reset link for ${to}: ${resetLink}`)
    return
  }
  await client.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: 'Reset your Prepit password',
    html: `
      <p>You requested a password reset.</p>
      <p><a href="${resetLink}">Click here to reset your password</a></p>
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request this, ignore this email.</p>
    `,
  })
}

export async function sendVerificationEmail(to: string, verifyLink: string) {
  if (!client) {
    console.log(`[Email STUB] Verify link for ${to}: ${verifyLink}`)
    return
  }
  await client.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: 'Verify your email',
    html: `
      <p>Please verify your email address.</p>
      <p><a href="${verifyLink}">Verify Email</a></p>
    `,
  })
}
