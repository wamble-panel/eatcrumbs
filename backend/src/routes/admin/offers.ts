import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabase } from '../../config/supabase'
import { requireAdmin } from '../../middleware/auth'

// ── Promo codes ───────────────────────────────────────────────────────────────
const promoBody = z.object({
  code: z.string().min(1).max(50).toUpperCase(),
  promoType: z.enum(['percentage', 'fixed', 'free_delivery']),
  value: z.number().min(0),
  minOrder: z.number().min(0).default(0),
  maxUses: z.number().int().positive().optional(),
  perCustomer: z.number().int().positive().default(1),
  isActive: z.boolean().default(true),
  expiresAt: z.string().datetime().optional(),
})

export default async function adminOffersRoutes(fastify: FastifyInstance) {
  // ── PROMO CODES ─────────────────────────────────────────────────────────────

  // GET /promo/list
  fastify.get('/promo/list', { preHandler: requireAdmin }, async (request) => {
    const restaurantId = request.admin!.restaurant_id
    const { data } = await supabase
      .from('promo_codes')
      .select('id, code, promo_type, value, min_order, max_uses, uses_count, per_customer, is_active, expires_at, created_at')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })

    return { promoCodes: data ?? [] }
  })

  // POST /promo/create
  fastify.post('/promo/create', { preHandler: requireAdmin }, async (request, reply) => {
    const restaurantId = request.admin!.restaurant_id
    const body = promoBody.parse(request.body)

    // Check unique code within restaurant
    const { data: existing } = await supabase
      .from('promo_codes')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('code', body.code)
      .single()

    if (existing) return reply.status(409).send({ error: 'Promo code already exists' })

    const { data, error } = await supabase
      .from('promo_codes')
      .insert({
        restaurant_id: restaurantId,
        code: body.code,
        promo_type: body.promoType,
        value: body.value,
        min_order: body.minOrder,
        max_uses: body.maxUses ?? null,
        per_customer: body.perCustomer,
        is_active: body.isActive,
        expires_at: body.expiresAt ?? null,
      })
      .select()
      .single()

    if (error) return reply.status(500).send({ error: error.message })
    return { promoCode: data }
  })

  // POST /promo/edit
  fastify.post('/promo/edit', { preHandler: requireAdmin }, async (request, reply) => {
    const restaurantId = request.admin!.restaurant_id
    const body = promoBody.extend({ id: z.number().int() }).parse(request.body)

    const { data: existing } = await supabase
      .from('promo_codes')
      .select('id')
      .eq('id', body.id)
      .eq('restaurant_id', restaurantId)
      .single()

    if (!existing) return reply.status(404).send({ error: 'Promo code not found' })

    const { data, error } = await supabase
      .from('promo_codes')
      .update({
        code: body.code,
        promo_type: body.promoType,
        value: body.value,
        min_order: body.minOrder,
        max_uses: body.maxUses ?? null,
        per_customer: body.perCustomer,
        is_active: body.isActive,
        expires_at: body.expiresAt ?? null,
      })
      .eq('id', body.id)
      .select()
      .single()

    if (error) return reply.status(500).send({ error: error.message })
    return { promoCode: data }
  })

  // POST /promo/delete
  fastify.post('/promo/delete', { preHandler: requireAdmin }, async (request, reply) => {
    const restaurantId = request.admin!.restaurant_id
    const body = z.object({ id: z.number().int() }).parse(request.body)

    const { error } = await supabase
      .from('promo_codes')
      .delete()
      .eq('id', body.id)
      .eq('restaurant_id', restaurantId)

    if (error) return reply.status(500).send({ error: error.message })
    return { success: true }
  })

  // ── POINTING SYSTEM (LOYALTY) ────────────────────────────────────────────────

  // GET /loyalty/pointing-system
  fastify.get('/loyalty/pointing-system', { preHandler: requireAdmin }, async (request) => {
    const restaurantId = request.admin!.restaurant_id
    const { data } = await supabase
      .from('pointing_systems')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .single()

    return { pointingSystem: data ?? null }
  })

  // POST /loyalty/pointing-system
  fastify.post('/loyalty/pointing-system', { preHandler: requireAdmin }, async (request, reply) => {
    const restaurantId = request.admin!.restaurant_id
    const body = z.object({
      pointsPerUnit: z.number().min(0),
      minimumSpend: z.number().min(0).default(0),
      redeemValue: z.number().min(0),
      pointsRequiredToRedeem: z.number().int().positive(),
      expiryDays: z.number().int().positive().optional(),
      isActive: z.boolean().default(true),
    }).parse(request.body)

    const { data: existing } = await supabase
      .from('pointing_systems')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .single()

    const payload = {
      restaurant_id: restaurantId,
      points_per_unit: body.pointsPerUnit,
      minimum_spend: body.minimumSpend,
      redeem_value: body.redeemValue,
      points_required_to_redeem: body.pointsRequiredToRedeem,
      expiry_days: body.expiryDays ?? null,
      is_active: body.isActive,
    }

    let result
    if (existing) {
      const { data, error } = await supabase
        .from('pointing_systems')
        .update(payload)
        .eq('restaurant_id', restaurantId)
        .select()
        .single()
      if (error) return reply.status(500).send({ error: error.message })
      result = data
    } else {
      const { data, error } = await supabase
        .from('pointing_systems')
        .insert(payload)
        .select()
        .single()
      if (error) return reply.status(500).send({ error: error.message })
      result = data
    }

    return { pointingSystem: result }
  })

  // ── FRANCHISE PACKAGE OFFERS ─────────────────────────────────────────────────

  // GET /offers/list
  fastify.get('/offers/list', { preHandler: requireAdmin }, async (request) => {
    const restaurantId = request.admin!.restaurant_id
    const q = z.object({ franchiseId: z.coerce.number().int().optional() }).parse(request.query)

    let query = supabase
      .from('franchise_package_offers')
      .select('id, name, name_arabic, price, image_url, is_active, sort_order, franchise_id')
      .eq('restaurant_id', restaurantId)
      .order('sort_order')

    if (q.franchiseId) query = query.eq('franchise_id', q.franchiseId)

    const { data } = await query
    return { offers: data ?? [] }
  })

  // POST /offers/save
  fastify.post('/offers/save', { preHandler: requireAdmin }, async (request, reply) => {
    const restaurantId = request.admin!.restaurant_id
    const body = z.object({
      id: z.number().int().optional(),
      franchiseId: z.number().int(),
      name: z.string().min(1),
      nameArabic: z.string().optional(),
      price: z.number().min(0),
      imageUrl: z.string().url().optional(),
      isActive: z.boolean().default(true),
      sortOrder: z.number().int().default(0),
    }).parse(request.body)

    // Verify franchise belongs to restaurant
    const { data: franchise } = await supabase
      .from('franchises')
      .select('id')
      .eq('id', body.franchiseId)
      .eq('restaurant_id', restaurantId)
      .single()

    if (!franchise) return reply.status(403).send({ error: 'Franchise not found' })

    const payload = {
      restaurant_id: restaurantId,
      franchise_id: body.franchiseId,
      name: body.name,
      name_arabic: body.nameArabic ?? null,
      price: body.price,
      image_url: body.imageUrl ?? null,
      is_active: body.isActive,
      sort_order: body.sortOrder,
    }

    let result
    if (body.id) {
      const { data, error } = await supabase
        .from('franchise_package_offers')
        .update(payload)
        .eq('id', body.id)
        .eq('restaurant_id', restaurantId)
        .select()
        .single()
      if (error) return reply.status(500).send({ error: error.message })
      result = data
    } else {
      const { data, error } = await supabase
        .from('franchise_package_offers')
        .insert(payload)
        .select()
        .single()
      if (error) return reply.status(500).send({ error: error.message })
      result = data
    }

    return { offer: result }
  })

  // POST /offers/delete
  fastify.post('/offers/delete', { preHandler: requireAdmin }, async (request, reply) => {
    const restaurantId = request.admin!.restaurant_id
    const body = z.object({ id: z.number().int() }).parse(request.body)

    const { error } = await supabase
      .from('franchise_package_offers')
      .delete()
      .eq('id', body.id)
      .eq('restaurant_id', restaurantId)

    if (error) return reply.status(500).send({ error: error.message })
    return { success: true }
  })

  // ── NOTIFICATIONS (broadcast to customers) ───────────────────────────────────

  // POST /notifications/send
  fastify.post('/notifications/send', { preHandler: requireAdmin }, async (request, reply) => {
    const restaurantId = request.admin!.restaurant_id
    const body = z.object({
      title: z.string().min(1),
      body: z.string().optional(),
      customerIds: z.array(z.string().uuid()).optional(),  // empty = all customers
    }).parse(request.body)

    let customerIds = body.customerIds
    if (!customerIds || customerIds.length === 0) {
      const { data } = await supabase
        .from('customers')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('is_visitor', false)
      customerIds = (data ?? []).map((c) => c.id)
    }

    if (customerIds.length === 0) return { sent: 0 }

    const notifications = customerIds.map((cid) => ({
      restaurant_id: restaurantId,
      customer_id: cid,
      title: body.title,
      body: body.body ?? null,
    }))

    // Insert in batches of 500
    const BATCH = 500
    for (let i = 0; i < notifications.length; i += BATCH) {
      await supabase.from('notifications').insert(notifications.slice(i, i + BATCH))
    }

    return { sent: customerIds.length }
  })

  // GET /notifications/list
  fastify.get('/notifications/list', { preHandler: requireAdmin }, async (request) => {
    const restaurantId = request.admin!.restaurant_id
    const q = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(50).default(20),
    }).parse(request.query)

    const from = (q.page - 1) * q.pageSize
    const to = from + q.pageSize - 1

    const { data, count } = await supabase
      .from('notifications')
      .select('id, title, body, created_at, customer_id', { count: 'exact' })
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .range(from, to)

    return {
      notifications: data ?? [],
      total: count ?? 0,
      page: q.page,
      pageSize: q.pageSize,
    }
  })
}
