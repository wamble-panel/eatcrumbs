import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabase } from '../../config/supabase'
import { requireAdmin } from '../../middleware/auth'

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
}
