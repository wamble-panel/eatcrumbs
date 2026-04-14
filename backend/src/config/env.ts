import { z } from 'zod'

const schema = z.object({
  PORT: z.string().default('3000'),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_CUSTOMER_EXPIRES_IN: z.string().default('30d'),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),

  PAYMOB_API_KEY: z.string().optional().default(''),
  PAYMOB_HMAC_SECRET: z.string().optional().default(''),
  PAYMOB_INTEGRATION_ID: z.string().optional().default(''),
  PAYMOB_IFRAME_ID: z.string().optional().default(''),
  PAYMOB_CURRENCY: z.string().default('EGP'),

  RESEND_API_KEY: z.string().optional().default(''),
  EMAIL_FROM: z.string().default('noreply@prepit.app'),

  WHATSAPP_API_TOKEN: z.string().optional().default(''),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(''),

  FOODICS_CLIENT_ID: z.string().optional().default(''),
  FOODICS_CLIENT_SECRET: z.string().optional().default(''),
  FOODICS_REDIRECT_URI: z.string().optional().default(''),
  FOODICS_LOYALTY_REDIRECT_URI: z.string().optional().default(''),
  FOODICS_SANDBOX: z.string().default('false'),

  CLOUDFLARE_API_TOKEN: z.string().optional().default(''),
  CLOUDFLARE_ZONE_ID: z.string().optional().default(''),

  VERCEL_API_TOKEN: z.string().optional().default(''),
  VERCEL_PROJECT_ID: z.string().optional().default(''),

  REDIS_URL: z.string().optional().default(''),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3001,http://localhost:3002'),
  PELIAS_API_URL: z.string().default('https://pilias.eg.prepit.app/v1'),

  BACKEND_URL: z.string().optional().default(''),
  ADMIN_FRONTEND_URL: z.string().optional().default('https://admin.prepit.app'),
  CUSTOMER_FRONTEND_URL: z.string().optional().default('https://prepit.app'),
})

function loadEnv() {
  const result = schema.safeParse(process.env)
  if (!result.success) {
    const missing = result.error.issues.map(i => i.path.join('.')).join(', ')
    throw new Error(`Missing/invalid environment variables: ${missing}`)
  }
  return result.data
}

export const env = loadEnv()
export type Env = typeof env
