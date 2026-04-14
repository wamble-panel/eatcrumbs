import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabase } from '../../config/supabase'
import { requireCustomer } from '../../middleware/auth'
import { getPointingSystem, calculateRedeemDiscount } from '../../services/points'
import { AppError } from '../../lib/errors'

export default async function customerLoyaltyRoutes(fastify: FastifyInstance) {
  // GET /loyalty/balance  — current points balance + system config
  fastify.get('/loyalty/balance', { preHandler: requireCustomer }, async (request) => {
    const customerId = request.customer!.customer_id
    const restaurantId = request.customer!.restaurant_id

    const [{ data: customer }, pointingSystem] = await Promise.all([
      supabase
        .from('customers')
        .select('points')
        .eq('id', customerId)
        .single(),
      getPointingSystem(restaurantId),
    ])

    return {
      points: customer?.points ?? 0,
      pointingSystem: pointingSystem ?? null,
    }
  })

  // GET /loyalty/transactions  — points history
  fastify.get('/loyalty/transactions', { preHandler: requireCustomer }, async (request) => {
    const customerId = request.customer!.customer_id
    const restaurantId = request.customer!.restaurant_id
    const q = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(50).default(20),
    }).parse(request.query)

    const from = (q.page - 1) * q.pageSize
    const to = from + q.pageSize - 1

    const { data, count } = await supabase
      .from('loyalty_transactions')
      .select('id, type, points, balance_after, receipt_id, created_at', { count: 'exact' })
      .eq('customer_id', customerId)
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .range(from, to)

    return {
      transactions: data ?? [],
      total: count ?? 0,
      page: q.page,
      pageSize: q.pageSize,
    }
  })

  // POST /loyalty/validate-redeem  — check how much discount N points gives
  fastify.post('/loyalty/validate-redeem', { preHandler: requireCustomer }, async (request) => {
    const restaurantId = request.customer!.restaurant_id
    const body = z.object({ pointsToRedeem: z.number().int().positive() }).parse(request.body)

    const [pointingSystem, { data: customer }] = await Promise.all([
      getPointingSystem(restaurantId),
      supabase.from('customers').select('points').eq('id', request.customer!.customer_id).single(),
    ])

    if (!pointingSystem) return { discount: 0, valid: false, reason: 'No loyalty program active' }

    const balance = customer?.points ?? 0
    if (body.pointsToRedeem > balance) {
      return { discount: 0, valid: false, reason: 'Insufficient points' }
    }

    const discount = calculateRedeemDiscount(body.pointsToRedeem, pointingSystem)
    return { discount, valid: true }
  })

  // POST /promo/validate  — validate a promo code without applying it
  fastify.post('/promo/validate', { preHandler: requireCustomer }, async (request) => {
    const restaurantId = request.customer!.restaurant_id
    const body = z.object({
      code: z.string().min(1),
      orderTotal: z.number().min(0),
      deliveryFee: z.number().min(0).default(0),
    }).parse(request.body)

    const { data: promo } = await supabase
      .from('promo_codes')
      .select('id, promo_type, value, min_order, max_uses, uses_count, expires_at')
      .eq('restaurant_id', restaurantId)
      .eq('code', body.code.toUpperCase())
      .eq('is_active', true)
      .single()

    if (!promo) return { valid: false, reason: 'Invalid promo code' }
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return { valid: false, reason: 'Promo code has expired' }
    }
    if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) {
      return { valid: false, reason: 'Promo code has reached its usage limit' }
    }
    if (body.orderTotal < promo.min_order) {
      return { valid: false, reason: `Minimum order of ${promo.min_order} required` }
    }

    let discount = 0
    if (promo.promo_type === 'percentage') {
      discount = Math.min(body.orderTotal * (promo.value / 100), body.orderTotal)
    } else if (promo.promo_type === 'fixed') {
      discount = Math.min(promo.value, body.orderTotal)
    } else if (promo.promo_type === 'free_delivery') {
      discount = body.deliveryFee
    }

    return {
      valid: true,
      discount: Math.round(discount * 100) / 100,
      promoType: promo.promo_type,
    }
  })

  // GET /loyalty/referral-info  — customer referral code and referral count
  fastify.get('/loyalty/referral-info', { preHandler: requireCustomer }, async (request) => {
    const customerId = request.customer!.customer_id
    const restaurantId = request.customer!.restaurant_id

    const { data: customer } = await supabase
      .from('customers')
      .select('referral_code')
      .eq('id', customerId)
      .single()

    const { count: referralCount } = await supabase
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', customerId)
      .eq('restaurant_id', restaurantId)

    return {
      referralCode: customer?.referral_code ?? null,
      referralCount: referralCount ?? 0,
    }
  })
}
