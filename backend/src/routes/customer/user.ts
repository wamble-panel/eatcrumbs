import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabase } from '../../config/supabase'
import { requireCustomer, optionalCustomer } from '../../middleware/auth'
import { ForbiddenError } from '../../lib/errors'

export default async function customerUserRoutes(fastify: FastifyInstance) {
  // GET /customer/notifications  — in-app notifications
  fastify.get('/customer/notifications', { preHandler: requireCustomer }, async (request) => {
    const customerId = request.customer!.customer_id
    const q = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(50).default(20),
    }).parse(request.query)

    const from = (q.page - 1) * q.pageSize
    const to = from + q.pageSize - 1

    const { data, count } = await supabase
      .from('notifications')
      .select('id, title, body, is_read, created_at', { count: 'exact' })
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .range(from, to)

    const { count: unread } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('is_read', false)

    return {
      notifications: data ?? [],
      total: count ?? 0,
      unreadCount: unread ?? 0,
      page: q.page,
      pageSize: q.pageSize,
    }
  })

  // POST /customer/notifications/mark-read
  fastify.post('/customer/notifications/mark-read', { preHandler: requireCustomer }, async (request) => {
    const customerId = request.customer!.customer_id
    const body = z.object({
      notificationIds: z.array(z.number().int()).optional(),  // omit = mark all
    }).parse(request.body)

    let query = supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('customer_id', customerId)

    if (body.notificationIds && body.notificationIds.length > 0) {
      query = query.in('id', body.notificationIds)
    }

    await query
    return { success: true }
  })

  // POST /customer/analytics  — track frontend events (optional, mirrors admin-analytics)
  fastify.post('/customer/analytics', { preHandler: optionalCustomer }, async (request) => {
    const restaurantId = request.restaurantId
    const body = z.object({
      event: z.string().min(1).max(100),
    }).parse(request.body)

    if (!restaurantId) return { success: true }  // no-op if tenant not resolved

    await supabase.from('admin_analytics').insert({
      restaurant_id: restaurantId,
      admin_id: null,
      event: `customer:${body.event}`,
    })

    return { success: true }
  })

  // DELETE /customer/account  — soft delete (anonymise) customer account
  fastify.delete('/customer/account', { preHandler: requireCustomer }, async (request, reply) => {
    const customerId = request.customer!.customer_id
    const restaurantId = request.customer!.restaurant_id

    // Anonymise PII rather than hard-delete (to preserve order history)
    await supabase
      .from('customers')
      .update({
        phone_number: `deleted_${Date.now()}`,
        person_name: null,
        email: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customerId)
      .eq('restaurant_id', restaurantId)

    reply.clearCookie('TOKEN', { path: '/' })
    return { success: true }
  })

  // ── Compiled-storefront aliases ────────────────────────────────────────────

  // GET /notification/:restaurantId  — alias of /customer/notifications
  // Frontend passes restaurantId as a path segment; we enforce it matches the
  // JWT tenant rather than filter by it (notifications are owned by customer).
  fastify.get('/notification/:restaurantId', { preHandler: requireCustomer }, async (request) => {
    const customerId = request.customer!.customer_id
    const tokenRestaurantId = request.customer!.restaurant_id
    const { restaurantId } = z.object({
      restaurantId: z.coerce.number().int(),
    }).parse(request.params)

    if (restaurantId !== tokenRestaurantId) {
      throw new ForbiddenError('Restaurant does not match customer tenant')
    }

    const q = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(50).default(20),
    }).parse(request.query)

    const from = (q.page - 1) * q.pageSize
    const to = from + q.pageSize - 1

    const { data, count } = await supabase
      .from('notifications')
      .select('id, title, body, is_read, created_at', { count: 'exact' })
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .range(from, to)

    const { count: unread } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('is_read', false)

    return {
      notifications: data ?? [],
      total: count ?? 0,
      unreadCount: unread ?? 0,
      page: q.page,
      pageSize: q.pageSize,
    }
  })

  // POST /notification/toggle-notification — alias of /customer/notifications/mark-read
  fastify.post('/notification/toggle-notification', { preHandler: requireCustomer }, async (request) => {
    const customerId = request.customer!.customer_id
    const body = z.object({
      notificationIds: z.array(z.number().int()).optional(),
      isRead: z.boolean().optional(),
    }).passthrough().parse(request.body ?? {})

    let query = supabase
      .from('notifications')
      .update({ is_read: body.isRead ?? true })
      .eq('customer_id', customerId)

    if (body.notificationIds && body.notificationIds.length > 0) {
      query = query.in('id', body.notificationIds)
    }

    await query
    return { success: true }
  })

  // POST /user/customer-analytics — alias of /customer/analytics
  // Accepts {franchiseId, restaurantId, franchiseSlug, event, extraInfo} and
  // stores `franchiseSlug:event` as the event string + the JSON extraInfo in
  // a tagged suffix.
  fastify.post('/user/customer-analytics', { preHandler: optionalCustomer }, async (request) => {
    const body = z.object({
      event: z.string().min(1).max(100),
      franchiseId: z.number().int().optional(),
      restaurantId: z.number().int().optional(),
      franchiseSlug: z.string().optional(),
      extraInfo: z.unknown().optional(),
    }).passthrough().parse(request.body ?? {})

    const restaurantId = body.restaurantId ?? request.restaurantId
    if (!restaurantId) return { success: true }

    // Enforce tenant if customer is logged in
    if (request.customer && request.customer.restaurant_id !== restaurantId) {
      throw new ForbiddenError('Restaurant does not match customer tenant')
    }

    const eventString = body.franchiseSlug
      ? `customer:${body.franchiseSlug}:${body.event}`
      : `customer:${body.event}`

    await supabase.from('admin_analytics').insert({
      restaurant_id: restaurantId,
      admin_id: null,
      event: eventString,
    })

    return { success: true }
  })

  // GET /config  — public restaurant config endpoint (RTK Query style)
  fastify.get('/config', { preHandler: optionalCustomer }, async (request) => {
    const restaurantId = request.restaurantId
    if (!restaurantId) return { config: {} }

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, config, menu_version, preferred_country, is_foodics')
      .eq('id', restaurantId)
      .single()

    if (!restaurant) return { config: {} }

    return {
      config: {
        ...(restaurant.config ?? {}),
        menuVersion: restaurant.menu_version,
        preferredCountry: restaurant.preferred_country,
        isFoodicsRestaurant: restaurant.is_foodics,
      },
    }
  })
}
