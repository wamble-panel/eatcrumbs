import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabase } from '../../config/supabase'
import { verifyHmac } from '../../services/paymob'
import { awardPoints, calculatePointsEarned, getPointingSystem } from '../../services/points'
import { ReceiptState } from '../../types'

const webhookQuerySchema = z.object({
  hmac: z.string().min(1),
})

const webhookRedirectQuerySchema = z.object({
  success: z.string().optional(),
  order: z.string().optional(),
})

export default async function paymobWebhookRoutes(fastify: FastifyInstance) {
  // POST /webhooks/paymob  — payment transaction callback
  // Paymob sends this when a payment is completed (success or failure)
  fastify.post('/paymob', { config: { rateLimit: { max: 200, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = request.body as any

    // Paymob sends hmac as a query param: ?hmac=...
    const queryParsed = webhookQuerySchema.safeParse(request.query)
    if (!queryParsed.success) {
      fastify.log.warn('Paymob webhook: missing hmac query param')
      return reply.status(400).send({ error: 'Missing hmac' })
    }

    const hmacParam = queryParsed.data.hmac

    // Verify HMAC signature
    const isValid = verifyHmac(body, hmacParam)
    if (!isValid) {
      fastify.log.warn({ body }, 'Paymob webhook: invalid HMAC signature')
      return reply.status(401).send({ error: 'Invalid signature' })
    }

    // Paymob transaction object is nested under obj
    const txn = body?.obj
    if (!txn) return reply.status(200).send({ received: true })

    const isPaid = txn.success === true
    const txnId = String(txn.id ?? '')
    const paymobOrderId = String(txn.order?.id ?? '')
    const amountCents = txn.amount_cents ?? 0

    fastify.log.info({ txnId, paymobOrderId, isPaid }, 'Paymob webhook received')

    // Look up our receipt by paymob_order_id
    const { data: receipt } = await supabase
      .from('receipts')
      .select('id, restaurant_id, customer_id, total, is_paid, state, paymob_txn_id')
      .eq('paymob_order_id', paymobOrderId)
      .single()

    if (!receipt) {
      fastify.log.warn({ paymobOrderId }, 'Paymob webhook: receipt not found')
      return reply.status(200).send({ received: true })  // 200 so Paymob doesn't retry
    }

    // Idempotency: skip if already processed
    if (receipt.is_paid) {
      return reply.status(200).send({ received: true })
    }

    if (isPaid) {
      await supabase
        .from('receipts')
        .update({
          is_paid: true,
          paymob_txn_id: txnId,
          state: ReceiptState.PENDING,   // stays PENDING — merchant must accept
          updated_at: new Date().toISOString(),
        })
        .eq('id', receipt.id)

      // Award loyalty points for paid online orders
      if (receipt.customer_id) {
        const pointingSystem = await getPointingSystem(receipt.restaurant_id)
        if (pointingSystem) {
          const pointsEarned = calculatePointsEarned(receipt.total, pointingSystem)
          if (pointsEarned > 0) {
            try {
              await awardPoints(receipt.customer_id, receipt.restaurant_id, receipt.id, pointsEarned)
              await supabase
                .from('receipts')
                .update({ points_earned: pointsEarned })
                .eq('id', receipt.id)
            } catch (err) {
              fastify.log.error({ err }, 'Failed to award points after Paymob payment')
            }
          }
        }
      }

      // Supabase Realtime automatically broadcasts the receipts UPDATE
      // (is_paid: true, state: PENDING) to the customer's subscription.

      fastify.log.info({ receiptId: receipt.id }, 'Paymob: payment confirmed')
    } else {
      // Payment failed — mark as failed state so frontend can retry or show error
      await supabase
        .from('receipts')
        .update({
          paymob_txn_id: txnId,
          state: ReceiptState.CANCELLED,
          updated_at: new Date().toISOString(),
        })
        .eq('id', receipt.id)

      fastify.log.warn({ receiptId: receipt.id }, 'Paymob: payment failed')
    }

    // Always return 200 to stop Paymob retrying
    return reply.status(200).send({ received: true })
  })

  // GET /webhooks/paymob  — Paymob also sends a GET callback for redirect after payment
  // This is the customer-facing redirect after iframe payment
  fastify.get('/paymob', async (request, reply) => {
    const q = webhookRedirectQuerySchema.parse(request.query)
    const success = q.success === 'true'
    const paymobOrderId = q.order ?? ''

    // Find our receipt
    const { data: receipt } = await supabase
      .from('receipts')
      .select('id, restaurant_id, franchise_id')
      .eq('paymob_order_id', paymobOrderId)
      .single()

    if (!receipt) {
      return reply.redirect('/')
    }

    // Redirect to the storefront tracking page
    const frontendUrl = process.env.CUSTOMER_FRONTEND_URL ?? 'https://prepit.app'
    if (success) {
      return reply.redirect(`${frontendUrl}/order/${receipt.id}?payment=success`)
    } else {
      return reply.redirect(`${frontendUrl}/order/${receipt.id}?payment=failed`)
    }
  })
}
