import crypto from 'crypto'

// In-memory OTP store — replace with Redis in production via REDIS_URL
const store = new Map<string, { code: string; expiresAt: number }>()

const OTP_TTL_MS = 5 * 60 * 1000 // 5 minutes

export function generateOtp(): string {
  return String(crypto.randomInt(100000, 999999))
}

export function storeOtp(key: string, code: string): void {
  store.set(key, { code, expiresAt: Date.now() + OTP_TTL_MS })
}

export function verifyOtp(key: string, code: string): boolean {
  const entry = store.get(key)
  if (!entry) return false
  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return false
  }
  if (entry.code !== code) return false
  store.delete(key)
  return true
}

export function otpKey(phoneNumber: string, restaurantId: number): string {
  return `otp:${restaurantId}:${phoneNumber}`
}
