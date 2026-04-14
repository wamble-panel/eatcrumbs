import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabase } from '../../config/supabase'
import { requireAdmin } from '../../middleware/auth'
import { resolveDateRange } from '../../lib/dates'
import { TimeInterval } from '../../types'

export default async function adminFeedbackRoutes(fastify: FastifyInstance) {
  // GET /feedback/list
  fastify.get('/feedback/list', { preHandler: requireAdmin }, async (request) => {
    const restaurantId = request.admin!.restaurant_id
    const q = z.object({
      franchiseId: z.coerce.number().int().optional(),
      rating: z.coerce.number().int().min(1).max(5).optional(),
      isRead: z.enum(['true', 'false']).optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
    }).parse(request.query)

    const from = (q.page - 1) * q.pageSize
    const to = from + q.pageSize - 1

    let query = supabase
      .from('feedback')
      .select(
        'id, rating, comment, is_read, created_at, franchise_id, customer_id, receipt_id',
        { count: 'exact' },
      )
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (q.franchiseId) query = query.eq('franchise_id', q.franchiseId)
    if (q.rating) query = query.eq('rating', q.rating)
    if (q.isRead !== undefined) query = query.eq('is_read', q.isRead === 'true')

    const { data, count } = await query

    return {
      feedback: data ?? [],
      total: count ?? 0,
      page: q.page,
      pageSize: q.pageSize,
    }
  })

  // POST /feedback/mark-read
  fastify.post('/feedback/mark-read', { preHandler: requireAdmin }, async (request, reply) => {
    const restaurantId = request.admin!.restaurant_id
    const body = z.object({
      feedbackIds: z.array(z.number().int()).min(1),
    }).parse(request.body)

    const { error } = await supabase
      .from('feedback')
      .update({ is_read: true })
      .eq('restaurant_id', restaurantId)
      .in('id', body.feedbackIds)

    if (error) return reply.status(500).send({ error: error.message })
    return { success: true }
  })

  // GET /feedback/stats
  fastify.get('/feedback/stats', { preHandler: requireAdmin }, async (request) => {
    const restaurantId = request.admin!.restaurant_id

    const { data } = await supabase
      .from('feedback')
      .select('rating, is_read')
      .eq('restaurant_id', restaurantId)

    const all = data ?? []
    const total = all.length
    const unread = all.filter((f) => !f.is_read).length
    const avg = total > 0 ? all.reduce((s, f) => s + f.rating, 0) / total : 0
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const f of all) dist[f.rating] = (dist[f.rating] ?? 0) + 1

    return {
      total,
      unread,
      averageRating: Math.round(avg * 100) / 100,
      distribution: dist,
    }
  })

  // ── Compiled-admin POST-with-body aliases ───────────────────────────────────
  // The admin bundle sends filter criteria as POST bodies. Paths also differ.

  // POST /feedback — alias of /feedback/list, with body {franchiseId?, rating?, page, pageSize}
  fastify.post('/feedback', { preHandler: requireAdmin }, async (request) => {
    const restaurantId = request.admin!.restaurant_id
    const body = z.object({
      franchiseId: z.number().int().optional(),
      rating: z.number().int().min(1).max(5).optional(),
      isRead: z.boolean().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
    }).passthrough().parse(request.body ?? {})

    const from = (body.page - 1) * body.pageSize
    const to = from + body.pageSize - 1

    let query = supabase
      .from('feedback')
      .select(
        'id, rating, comment, is_read, created_at, franchise_id, customer_id, receipt_id',
        { count: 'exact' },
      )
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (body.franchiseId) query = query.eq('franchise_id', body.franchiseId)
    if (body.rating) query = query.eq('rating', body.rating)
    if (body.isRead !== undefined) query = query.eq('is_read', body.isRead)

    const { data, count } = await query

    return {
      feedback: data ?? [],
      total: count ?? 0,
      page: body.page,
      pageSize: body.pageSize,
    }
  })

  // POST /feedback/analytics — date-ranged aggregate
  fastify.post('/feedback/analytics', { preHandler: requireAdmin }, async (request) => {
    const restaurantId = request.admin!.restaurant_id
    const body = z.object({
      timeInterval: z.nativeEnum(TimeInterval).default(TimeInterval.THIS_MONTH),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      franchiseId: z.number().int().optional(),
    }).passthrough().parse(request.body ?? {})

    const { startDate: start, endDate: end } = resolveDateRange(body.timeInterval, body.startDate, body.endDate)

    let fbQuery = supabase
      .from('feedback')
      .select('id, rating, franchise_id, created_at')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', start)
      .lte('created_at', end)

    if (body.franchiseId) fbQuery = fbQuery.eq('franchise_id', body.franchiseId)

    const { data: fb } = await fbQuery
    const all = fb ?? []
    const total = all.length
    const avg = total > 0 ? all.reduce((s, f) => s + f.rating, 0) / total : 0
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const f of all) dist[f.rating] = (dist[f.rating] ?? 0) + 1

    return {
      totalFeedback: total,
      averageRating: Math.round(avg * 100) / 100,
      distribution: dist,
    }
  })

  // POST /feedback/overall — summary for dashboard (alias of /feedback/stats with body filter)
  fastify.post('/feedback/overall', { preHandler: requireAdmin }, async (request) => {
    const restaurantId = request.admin!.restaurant_id
    const body = z.object({
      franchiseId: z.number().int().optional(),
    }).passthrough().parse(request.body ?? {})

    let query = supabase
      .from('feedback')
      .select('rating, is_read')
      .eq('restaurant_id', restaurantId)

    if (body.franchiseId) query = query.eq('franchise_id', body.franchiseId)

    const { data } = await query
    const all = data ?? []
    const total = all.length
    const unread = all.filter((f) => !f.is_read).length
    const avg = total > 0 ? all.reduce((s, f) => s + f.rating, 0) / total : 0
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const f of all) dist[f.rating] = (dist[f.rating] ?? 0) + 1

    return {
      total,
      unread,
      averageRating: Math.round(avg * 100) / 100,
      distribution: dist,
    }
  })

  // POST /feedback/pagination — total page count under the given filter
  fastify.post('/feedback/pagination', { preHandler: requireAdmin }, async (request) => {
    const restaurantId = request.admin!.restaurant_id
    const body = z.object({
      franchiseId: z.number().int().optional(),
      rating: z.number().int().min(1).max(5).optional(),
      isRead: z.boolean().optional(),
      pageSize: z.number().int().min(1).max(100).default(20),
    }).passthrough().parse(request.body ?? {})

    let query = supabase
      .from('feedback')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)

    if (body.franchiseId) query = query.eq('franchise_id', body.franchiseId)
    if (body.rating) query = query.eq('rating', body.rating)
    if (body.isRead !== undefined) query = query.eq('is_read', body.isRead)

    const { count } = await query
    const total = count ?? 0
    const pages = Math.max(1, Math.ceil(total / body.pageSize))

    return { total, pages, pageSize: body.pageSize }
  })
}
