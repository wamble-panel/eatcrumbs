import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabase } from '../../config/supabase'
import { requireAdmin } from '../../middleware/auth'
import { resolveDateRange } from '../../lib/dates'
import { TimeInterval } from '../../types'

// ── Shared query-string schema ────────────────────────────────────────────────
const rangeQuery = z.object({
  timeInterval: z.nativeEnum(TimeInterval).default(TimeInterval.THIS_MONTH),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  franchiseId: z.coerce.number().int().optional(),
})

export default async function adminDashboardRoutes(fastify: FastifyInstance) {
  // GET /dashboard/overview
  fastify.get('/dashboard/overview', { preHandler: requireAdmin }, async (request, reply) => {
    const restaurantId = request.admin!.restaurant_id
    const query = rangeQuery.parse(request.query)
    const { start, end } = resolveDateRange(query.timeInterval, query.startDate, query.endDate)

    let receiptsQuery = supabase
      .from('receipts')
      .select('id, total, state, order_type, created_at, franchise_id')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())

    if (query.franchiseId) {
      receiptsQuery = receiptsQuery.eq('franchise_id', query.franchiseId)
    }

    const { data: receipts } = await receiptsQuery

    const allReceipts = receipts ?? []
    const delivered = allReceipts.filter((r) => r.state === 'DELIVERED')
    const totalRevenue = delivered.reduce((sum, r) => sum + Number(r.total), 0)
    const totalOrders = allReceipts.length
    const deliveredOrders = delivered.length
    const cancelledOrders = allReceipts.filter((r) => r.state === 'CANCELLED').length
    const avgOrderValue = deliveredOrders > 0 ? totalRevenue / deliveredOrders : 0

    // Orders by day
    const ordersByDay: Record<string, { orders: number; revenue: number }> = {}
    for (const r of delivered) {
      const day = r.created_at.slice(0, 10)
      if (!ordersByDay[day]) ordersByDay[day] = { orders: 0, revenue: 0 }
      ordersByDay[day].orders += 1
      ordersByDay[day].revenue += Number(r.total)
    }

    // Orders by type
    const byType: Record<string, number> = {}
    for (const r of allReceipts) {
      byType[r.order_type] = (byType[r.order_type] ?? 0) + 1
    }

    // New customers
    const { count: newCustomers } = await supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalOrders,
      deliveredOrders,
      cancelledOrders,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      newCustomers: newCustomers ?? 0,
      ordersByDay,
      ordersByType: byType,
    }
  })

  // GET /dashboard/item-sales
  fastify.get('/dashboard/item-sales', { preHandler: requireAdmin }, async (request) => {
    const restaurantId = request.admin!.restaurant_id
    const query = rangeQuery.parse(request.query)
    const { start, end } = resolveDateRange(query.timeInterval, query.startDate, query.endDate)

    let rcptQuery = supabase
      .from('receipts')
      .select('id, franchise_id')
      .eq('restaurant_id', restaurantId)
      .eq('state', 'DELIVERED')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())

    if (query.franchiseId) rcptQuery = rcptQuery.eq('franchise_id', query.franchiseId)

    const { data: receipts } = await rcptQuery
    const receiptIds = (receipts ?? []).map((r) => r.id)

    if (receiptIds.length === 0) return { items: [] }

    const { data: receiptItems } = await supabase
      .from('receipt_items')
      .select('item_id, name, name_arabic, price, quantity')
      .in('receipt_id', receiptIds)

    // Aggregate by item_id
    const agg: Record<string, { name: string; name_arabic: string | null; quantity: number; revenue: number }> = {}
    for (const ri of receiptItems ?? []) {
      const key = String(ri.item_id ?? ri.name)
      if (!agg[key]) agg[key] = { name: ri.name, name_arabic: ri.name_arabic, quantity: 0, revenue: 0 }
      agg[key].quantity += ri.quantity
      agg[key].revenue += Number(ri.price) * ri.quantity
    }

    const items = Object.entries(agg)
      .map(([id, v]) => ({ itemId: id, ...v, revenue: Math.round(v.revenue * 100) / 100 }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 50)

    return { items }
  })

  // GET /dashboard/feedback-analytics
  fastify.get('/dashboard/feedback-analytics', { preHandler: requireAdmin }, async (request) => {
    const restaurantId = request.admin!.restaurant_id
    const query = rangeQuery.parse(request.query)
    const { start, end } = resolveDateRange(query.timeInterval, query.startDate, query.endDate)

    let fbQuery = supabase
      .from('feedback')
      .select('id, rating, franchise_id, created_at')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())

    if (query.franchiseId) fbQuery = fbQuery.eq('franchise_id', query.franchiseId)

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

  // GET /dashboard/customers-analytics
  fastify.get('/dashboard/customers-analytics', { preHandler: requireAdmin }, async (request) => {
    const restaurantId = request.admin!.restaurant_id
    const query = rangeQuery.parse(request.query)
    const { start, end } = resolveDateRange(query.timeInterval, query.startDate, query.endDate)

    const { count: total } = await supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)

    const { count: newCount } = await supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())

    // Repeat customers: placed > 1 order
    const { data: multiOrder } = await supabase
      .from('receipts')
      .select('customer_id')
      .eq('restaurant_id', restaurantId)
      .eq('state', 'DELIVERED')
      .not('customer_id', 'is', null)

    const orderCounts: Record<string, number> = {}
    for (const r of multiOrder ?? []) {
      if (r.customer_id) orderCounts[r.customer_id] = (orderCounts[r.customer_id] ?? 0) + 1
    }
    const repeatCustomers = Object.values(orderCounts).filter((c) => c > 1).length

    return {
      totalCustomers: total ?? 0,
      newCustomers: newCount ?? 0,
      repeatCustomers,
    }
  })

  // GET /dashboard/orders  (paginated order list for admin)
  fastify.get('/dashboard/orders', { preHandler: requireAdmin }, async (request) => {
    const restaurantId = request.admin!.restaurant_id
    const q = z.object({
      timeInterval: z.nativeEnum(TimeInterval).default(TimeInterval.TODAY),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      franchiseId: z.coerce.number().int().optional(),
      state: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
    }).parse(request.query)

    const { start, end } = resolveDateRange(q.timeInterval, q.startDate, q.endDate)
    const from = (q.page - 1) * q.pageSize
    const to = from + q.pageSize - 1

    let ordersQuery = supabase
      .from('receipts')
      .select(
        'id, order_number, state, order_type, payment_method, total, discount, delivery_fee, notes, created_at, franchise_id, customer_id, is_paid, estimated_minutes, table_number',
        { count: 'exact' },
      )
      .eq('restaurant_id', restaurantId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false })
      .range(from, to)

    if (q.franchiseId) ordersQuery = ordersQuery.eq('franchise_id', q.franchiseId)
    if (q.state) ordersQuery = ordersQuery.eq('state', q.state)

    const { data: orders, count } = await ordersQuery

    return {
      orders: orders ?? [],
      total: count ?? 0,
      page: q.page,
      pageSize: q.pageSize,
    }
  })
}
