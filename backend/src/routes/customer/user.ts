import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabase } from '../../config/supabase'
import { requireCustomer, optionalCustomer } from '../../middleware/auth'

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
