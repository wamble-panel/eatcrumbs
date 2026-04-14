import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import fastifyMultipart from '@fastify/multipart'
import { env } from './config/env'
import { registerCors } from './plugins/cors'
import { registerRateLimit } from './plugins/rateLimit'
import { registerSocket } from './plugins/socket'
import { resolveTenant } from './middleware/tenant'

// Admin routes
import adminAuthRoutes from './routes/admin/auth'
import adminInfoRoutes from './routes/admin/info'
import adminMenuRoutes from './routes/admin/menu'
import adminDashboardRoutes from './routes/admin/dashboard'
import adminFeedbackRoutes from './routes/admin/feedback'
import adminCustomersRoutes from './routes/admin/customers'
import adminOffersRoutes from './routes/admin/offers'
import adminFoodicsRoutes from './routes/admin/foodics'
import adminFranchisesRoutes from './routes/admin/franchises'

// Customer routes
import customerAuthRoutes from './routes/customer/auth'
import customerMenuRoutes from './routes/customer/menu'
import customerOrdersRoutes from './routes/customer/orders'
import customerDeliveryRoutes from './routes/customer/delivery'
import customerLoyaltyRoutes from './routes/customer/loyalty'
import customerUserRoutes from './routes/customer/user'

// Webhook routes
import paymobWebhookRoutes from './routes/webhooks/paymob'

async function build() {
  const fastify = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'warn' : 'info',
      ...(env.NODE_ENV !== 'production' && {
        transport: { target: 'pino-pretty', options: { colorize: true } },
      }),
    },
    trustProxy: true,
  })

  // ── Plugins ────────────────────────────────────────────────────────────────
  await registerCors(fastify)
  await registerRateLimit(fastify)

  await fastify.register(fastifyCookie)
  await fastify.register(fastifyMultipart, {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB global limit
  })

  registerSocket(fastify)

  // ── Global error handler ───────────────────────────────────────────────────
  fastify.setErrorHandler((error, _request, reply) => {
    // Zod validation errors
    if (error.name === 'ZodError') {
      return reply.status(400).send({ error: 'Validation error', details: (error as any).errors })
    }
    // Our custom AppErrors
    const status = (error as any).statusCode ?? 500
    if (status < 500) {
      return reply.status(status).send({ error: error.message })
    }
    fastify.log.error(error)
    return reply.status(500).send({ error: 'Internal server error' })
  })

  // ── Tenant resolution — runs before every request ─────────────────────────
  fastify.addHook('preHandler', resolveTenant)

  // ── Health check ───────────────────────────────────────────────────────────
  fastify.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

  // ── Admin routes  (prefix: /admin/v2) ─────────────────────────────────────
  await fastify.register(async (admin) => {
    await admin.register(adminAuthRoutes)
    await admin.register(adminInfoRoutes)
    await admin.register(adminMenuRoutes)
    await admin.register(adminDashboardRoutes)
    await admin.register(adminFeedbackRoutes)
    await admin.register(adminCustomersRoutes)
    await admin.register(adminOffersRoutes)
    await admin.register(adminFoodicsRoutes)
    await admin.register(adminFranchisesRoutes)
  }, { prefix: '/admin/v2' })

  // ── Customer routes  (no extra prefix — frontend calls /restaurant/:id etc) ─
  await fastify.register(async (customer) => {
    await customer.register(customerAuthRoutes)
    await customer.register(customerMenuRoutes)
    await customer.register(customerOrdersRoutes)
    await customer.register(customerDeliveryRoutes)
    await customer.register(customerLoyaltyRoutes)
    await customer.register(customerUserRoutes)
  })

  // ── Webhook routes ─────────────────────────────────────────────────────────
  await fastify.register(paymobWebhookRoutes, { prefix: '/webhooks' })

  return fastify
}

async function start() {
  const fastify = await build()
  const port = Number(env.PORT ?? 3001)
  const host = env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'

  try {
    await fastify.listen({ port, host })
    console.log(`Server listening on ${host}:${port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
