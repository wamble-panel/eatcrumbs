import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabase } from '../../config/supabase'
import { requireAdmin } from '../../middleware/auth'
import { ReceiptState } from '../../types'

const franchiseBody = z.object({
  name: z.string().min(1),
  nameArabic: z.string().optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with hyphens'),
  address: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  phone: z.string().optional(),
  isOnline: z.boolean().default(true),
  busyMode: z.boolean().default(false),
})

export default async function adminFranchisesRoutes(fastify: FastifyInstance) {
  // GET /franchise/list
  fastify.get('/franchise/list', { preHandler: requireAdmin }, async (request) => {
    const restaurantId = request.admin!.restaurant_id
    const { data } = await supabase
      .from('franchises')
      .select('id, name, name_arabic, slug, address, lat, lng, phone, is_online, busy_mode, created_at')
      .eq('restaurant_id', restaurantId)
      .order('id')

    return { franchises: data ?? [] }
  })

  // GET /franchise/:id
  fastify.get('/franchise/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const restaurantId = request.admin!.restaurant_id
    const { id } = z.object({ id: z.coerce.number().int() }).parse(request.params)

    const { data: franchise } = await supabase
      .from('franchises')
      .select('id, name, name_arabic, slug, address, lat, lng, phone, is_online, busy_mode, created_at')
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
      .single()

    if (!franchise) return reply.status(404).send({ error: 'Franchise not found' })

    // Fetch schedule slots
    const { data: schedule } = await supabase
      .from('schedule_slots')
      .select('id, day_of_week, open_time, close_time')
      .eq('franchise_id', id)
      .order('day_of_week')

    return { franchise, schedule: schedule ?? [] }
  })

  // POST /franchise/create
  fastify.post('/franchise/create', { preHandler: requireAdmin }, async (request, reply) => {
    const restaurantId = request.admin!.restaurant_id
    const body = franchiseBody.parse(request.body)

    // Slug must be globally unique
    const { data: slugExists } = await supabase
      .from('franchises')
      .select('id')
      .eq('slug', body.slug)
      .single()

    if (slugExists) return reply.status(409).send({ error: 'Slug already in use' })

    const { data, error } = await supabase
      .from('franchises')
      .insert({
        restaurant_id: restaurantId,
        name: body.name,
        name_arabic: body.nameArabic ?? null,
        slug: body.slug,
        address: body.address ?? null,
        lat: body.lat ?? null,
        lng: body.lng ?? null,
        phone: body.phone ?? null,
        is_online: body.isOnline,
        busy_mode: body.busyMode,
      })
      .select()
      .single()

    if (error) return reply.status(500).send({ error: error.message })
    return { franchise: data }
  })

  // POST /franchise/edit
  fastify.post('/franchise/edit', { preHandler: requireAdmin }, async (request, reply) => {
    const restaurantId = request.admin!.restaurant_id
    const body = franchiseBody.extend({ id: z.number().int() }).parse(request.body)

    // Verify ownership
    const { data: existing } = await supabase
      .from('franchises')
      .select('id, slug')
      .eq('id', body.id)
      .eq('restaurant_id', restaurantId)
      .single()

    if (!existing) return reply.status(404).send({ error: 'Franchise not found' })

    // Slug uniqueness (skip if unchanged)
    if (body.slug !== existing.slug) {
      const { data: slugExists } = await supabase
        .from('franchises')
        .select('id')
        .eq('slug', body.slug)
        .single()
      if (slugExists) return reply.status(409).send({ error: 'Slug already in use' })
    }

    const { data, error } = await supabase
      .from('franchises')
      .update({
        name: body.name,
        name_arabic: body.nameArabic ?? null,
        slug: body.slug,
        address: body.address ?? null,
        lat: body.lat ?? null,
        lng: body.lng ?? null,
        phone: body.phone ?? null,
        is_online: body.isOnline,
        busy_mode: body.busyMode,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id)
      .select()
      .single()

    if (error) return reply.status(500).send({ error: error.message })
    return { franchise: data }
  })

  // POST /franchise/toggle-online
  fastify.post('/franchise/toggle-online', { preHandler: requireAdmin }, async (request, reply) => {
    const restaurantId = request.admin!.restaurant_id
    const body = z.object({
      franchiseId: z.number().int(),
      isOnline: z.boolean(),
    }).parse(request.body)

    const { data: f } = await supabase
      .from('franchises')
      .select('id')
      .eq('id', body.franchiseId)
      .eq('restaurant_id', restaurantId)
      .single()

    if (!f) return reply.status(404).send({ error: 'Franchise not found' })

    await supabase
      .from('franchises')
      .update({ is_online: body.isOnline, updated_at: new Date().toISOString() })
      .eq('id', body.franchiseId)

    return { success: true }
  })

  // POST /franchise/toggle-busy
  fastify.post('/franchise/toggle-busy', { preHandler: requireAdmin }, async (request, reply) => {
    const restaurantId = request.admin!.restaurant_id
    const body = z.object({
      franchiseId: z.number().int(),
      busyMode: z.boolean(),
    }).parse(request.body)

    const { data: f } = await supabase
      .from('franchises')
      .select('id')
      .eq('id', body.franchiseId)
      .eq('restaurant_id', restaurantId)
      .single()

    if (!f) return reply.status(404).send({ error: 'Franchise not found' })

    await supabase
      .from('franchises')
      .update({ busy_mode: body.busyMode, updated_at: new Date().toISOString() })
      .eq('id', body.franchiseId)

    return { success: true }
  })

  // POST /franchise/schedule
  fastify.post('/franchise/schedule', { preHandler: requireAdmin }, async (request, reply) => {
    const restaurantId = request.admin!.restaurant_id
    const body = z.object({
      franchiseId: z.number().int(),
      slots: z.array(z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        openTime: z.string().regex(/^\d{2}:\d{2}$/),
        closeTime: z.string().regex(/^\d{2}:\d{2}$/),
      })),
    }).parse(request.body)

    // Verify franchise belongs to restaurant
    const { data: f } = await supabase
      .from('franchises')
      .select('id')
      .eq('id', body.franchiseId)
      .eq('restaurant_id', restaurantId)
      .single()

    if (!f) return reply.status(403).send({ error: 'Franchise not found' })

    // Replace all slots
    await supabase.from('schedule_slots').delete().eq('franchise_id', body.franchiseId)

    if (body.slots.length > 0) {
      await supabase.from('schedule_slots').insert(
        body.slots.map((s) => ({
          franchise_id: body.franchiseId,
          day_of_week: s.dayOfWeek,
          open_time: s.openTime,
          close_time: s.closeTime,
        }))
      )
    }

    return { success: true }
  })

  // GET /franchise/is-open/:franchiseId — public endpoint checked by storefront
  fastify.get('/franchise/is-open/:franchiseId', async (request, reply) => {
    const { franchiseId } = z.object({ franchiseId: z.coerce.number().int() }).parse(request.params)

    const { data: franchise } = await supabase
      .from('franchises')
      .select('id, is_online, busy_mode')
      .eq('id', franchiseId)
      .single()

    if (!franchise) return reply.status(404).send({ error: 'Franchise not found' })
    if (!franchise.is_online) return { isOpen: false, busyMode: false, reason: 'offline' }

    // Check schedule
    const now = new Date()
    const dayOfWeek = now.getDay()
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    const { data: slots } = await supabase
      .from('schedule_slots')
      .select('open_time, close_time')
      .eq('franchise_id', franchiseId)
      .eq('day_of_week', dayOfWeek)

    // No schedule = always open (during online hours)
    const isOpen = !slots || slots.length === 0 ||
      slots.some((s) => currentTime >= s.open_time && currentTime <= s.close_time)

    return {
      isOpen,
      busyMode: franchise.busy_mode,
      reason: isOpen ? null : 'closed',
    }
  })

  // POST /restaurant/update — update restaurant-level settings
  fastify.post('/restaurant/update', { preHandler: requireAdmin }, async (request, reply) => {
    const restaurantId = request.admin!.restaurant_id
    const body = z.object({
      name: z.string().min(1).optional(),
      nameArabic: z.string().optional(),
      backgroundImg: z.string().url().optional(),
      logoUrl: z.string().url().optional(),
      preferredCountry: z.string().length(2).optional(),
      mainFranchiseId: z.number().int().optional(),
      config: z.record(z.string(), z.unknown()).optional(),
    }).parse(request.body)

    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    if (body.name !== undefined) updates.name = body.name
    if (body.nameArabic !== undefined) updates.name_arabic = body.nameArabic
    if (body.backgroundImg !== undefined) updates.background_img = body.backgroundImg
    if (body.logoUrl !== undefined) updates.logo_url = body.logoUrl
    if (body.preferredCountry !== undefined) updates.preferred_country = body.preferredCountry
    if (body.mainFranchiseId !== undefined) updates.main_franchise_id = body.mainFranchiseId
    if (body.config !== undefined) updates.config = body.config

    const { data, error } = await supabase
      .from('restaurants')
      .update(updates)
      .eq('id', restaurantId)
      .select('id, name, name_arabic, background_img, logo_url, preferred_country, config, main_franchise_id')
      .single()

    if (error) return reply.status(500).send({ error: error.message })
    return { restaurant: data }
  })

  // POST /restaurant/orders/:orderId/update-state — merchant order management
  fastify.post('/restaurant/orders/:orderId/update-state', { preHandler: requireAdmin }, async (request, reply) => {
    const restaurantId = request.admin!.restaurant_id
    const { orderId } = z.object({ orderId: z.string().uuid() }).parse(request.params)
    const body = z.object({
      state: z.enum([
        ReceiptState.ACCEPTED,
        ReceiptState.READY,
        ReceiptState.ON_WAY_TO_PICKUP,
        ReceiptState.ON_WAY_TO_DELIVERY,
        ReceiptState.DELIVERED,
        ReceiptState.CANCELLED,
      ] as [string, ...string[]]),
      estimatedMinutes: z.number().int().optional(),
    }).parse(request.body)

    const { data: order } = await supabase
      .from('receipts')
      .select('id, state, franchise_id, customer_id, order_type, restaurant_id')
      .eq('id', orderId)
      .eq('restaurant_id', restaurantId)
      .single()

    if (!order) return reply.status(404).send({ error: 'Order not found' })

    const updates: Record<string, any> = {
      state: body.state,
      updated_at: new Date().toISOString(),
    }
    if (body.estimatedMinutes !== undefined) updates.estimated_minutes = body.estimatedMinutes

    await supabase.from('receipts').update(updates).eq('id', orderId)

    // Supabase Realtime automatically broadcasts the receipts UPDATE to admin,
    // franchise, and customer subscribers — no additional emit needed here.

    return { success: true, state: body.state }
  })

  // GET /restaurant/orders/:orderId — full order detail
  fastify.get('/restaurant/orders/:orderId', { preHandler: requireAdmin }, async (request, reply) => {
    const restaurantId = request.admin!.restaurant_id
    const { orderId } = z.object({ orderId: z.string().uuid() }).parse(request.params)

    const { data: order } = await supabase
      .from('receipts')
      .select('*, receipt_items(*)')
      .eq('id', orderId)
      .eq('restaurant_id', restaurantId)
      .single()

    if (!order) return reply.status(404).send({ error: 'Order not found' })
    return { order }
  })
}
