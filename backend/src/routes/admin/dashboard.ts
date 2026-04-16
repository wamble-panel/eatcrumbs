import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabase } from '../../config/supabase'
import { requireAdmin } from '../../middleware/auth'
import { resolveDateRange } from '../../lib/dates'
import { TimeInterval, ReportType } from '../../types'

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
    const { startDate: start, endDate: end } = resolveDateRange(query.timeInterval, query.startDate, query.endDate)

    let receiptsQuery = supabase
      .from('receipts')
      .select('id, total, state, order_type, created_at, franchise_id')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', start)
      .lte('created_at', end)

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
      .gte('created_at', start)
      .lte('created_at', end)

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
    const { startDate: start, endDate: end } = resolveDateRange(query.timeInterval, query.startDate, query.endDate)

    let rcptQuery = supabase
      .from('receipts')
      .select('id, franchise_id')
      .eq('restaurant_id', restaurantId)
      .eq('state', 'DELIVERED')
      .gte('created_at', start)
      .lte('created_at', end)

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
    const { startDate: start, endDate: end } = resolveDateRange(query.timeInterval, query.startDate, query.endDate)

    let fbQuery = supabase
      .from('feedback')
      .select('id, rating, franchise_id, created_at')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', start)
      .lte('created_at', end)

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
    const { startDate: start, endDate: end } = resolveDateRange(query.timeInterval, query.startDate, query.endDate)

    const { count: total } = await supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)

    const { count: newCount } = await supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .gte('created_at', start)
      .lte('created_at', end)

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

    const { startDate: start, endDate: end } = resolveDateRange(q.timeInterval, q.startDate, q.endDate)
    const from = (q.page - 1) * q.pageSize
    const to = from + q.pageSize - 1

    let ordersQuery = supabase
      .from('receipts')
      .select(
        'id, order_number, state, order_type, payment_method, total, discount, delivery_fee, notes, created_at, franchise_id, customer_id, is_paid, estimated_minutes, table_number',
        { count: 'exact' },
      )
      .eq('restaurant_id', restaurantId)
      .gte('created_at', start)
      .lte('created_at', end)
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

  // GET /dashboard/top-customers
  fastify.get('/dashboard/top-customers', { preHandler: requireAdmin }, async (request) => {
    const restaurantId = request.admin!.restaurant_id
    const query = rangeQuery.parse(request.query)
    const { startDate: start, endDate: end } = resolveDateRange(query.timeInterval, query.startDate, query.endDate)

    let rq = supabase
      .from('receipts')
      .select('customer_id, total, state')
      .eq('restaurant_id', restaurantId)
      .eq('state', 'DELIVERED')
      .gte('created_at', start)
      .lte('created_at', end)
      .not('customer_id', 'is', null)

    if (query.franchiseId) rq = rq.eq('franchise_id', query.franchiseId)

    const { data: receipts } = await rq

    // Aggregate by customer_id
    const agg: Record<string, { orders: number; total: number }> = {}
    for (const r of receipts ?? []) {
      if (!r.customer_id) continue
      if (!agg[r.customer_id]) agg[r.customer_id] = { orders: 0, total: 0 }
      agg[r.customer_id].orders += 1
      agg[r.customer_id].total += Number(r.total)
    }

    const topIds = Object.entries(agg)
      .sort((a, b) => b[1].orders - a[1].orders)
      .slice(0, 10)
      .map(([id]) => id)

    if (topIds.length === 0) return { customers: [] }

    const { data: customerRows } = await supabase
      .from('customers')
      .select('id, name, phone')
      .in('id', topIds)

    const customerMap: Record<string, { name: string | null; phone: string | null }> = {}
    for (const c of customerRows ?? []) customerMap[String(c.id)] = { name: c.name, phone: c.phone }

    const customers = topIds.map((id) => ({
      customerId: id,
      name: customerMap[id]?.name ?? null,
      phone: customerMap[id]?.phone ?? null,
      orders: agg[id].orders,
      total: Math.round(agg[id].total * 100) / 100,
    }))

    return { customers }
  })

  // ── POST /dashboard/report ──────────────────────────────────────────────────
  // Admin bundle's unified analytics endpoint. Body:
  //   { reportType, restaurantId?, franchiseId?, timeInterval, startDate?, endDate? }
  // `reportType` discriminates which aggregate to compute. Returned under a
  // single `data` key; the frontend adapts per reportType.
  fastify.post('/dashboard/report', { preHandler: requireAdmin }, async (request, reply) => {
    const adminRestaurantId = request.admin!.restaurant_id
    const body = z.object({
      reportType: z.nativeEnum(ReportType),
      restaurantId: z.number().int().optional(),
      franchiseId: z.number().int().optional(),
      timeInterval: z.nativeEnum(TimeInterval).default(TimeInterval.THIS_MONTH),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).passthrough().parse(request.body)

    if (body.restaurantId && body.restaurantId !== adminRestaurantId) {
      return reply.status(403).send({ error: 'Restaurant does not match admin tenant' })
    }

    const restaurantId = adminRestaurantId
    const { startDate: start, endDate: end } = resolveDateRange(body.timeInterval, body.startDate, body.endDate)

    switch (body.reportType) {
      case ReportType.ORDER_DATA: {
        let rq = supabase
          .from('receipts')
          .select('id, total, state, order_type, payment_method, created_at, franchise_id')
          .eq('restaurant_id', restaurantId)
          .gte('created_at', start)
          .lte('created_at', end)
        if (body.franchiseId) rq = rq.eq('franchise_id', body.franchiseId)
        const { data: receipts } = await rq
        const all = receipts ?? []
        const delivered = all.filter((r) => r.state === 'DELIVERED')
        const totalRevenue = delivered.reduce((s, r) => s + Number(r.total), 0)
        const byType: Record<string, number> = {}
        const byPayment: Record<string, number> = {}
        for (const r of all) {
          byType[r.order_type] = (byType[r.order_type] ?? 0) + 1
          byPayment[r.payment_method] = (byPayment[r.payment_method] ?? 0) + 1
        }
        const ordersByDay: Record<string, { orders: number; revenue: number }> = {}
        for (const r of delivered) {
          const day = r.created_at.slice(0, 10)
          if (!ordersByDay[day]) ordersByDay[day] = { orders: 0, revenue: 0 }
          ordersByDay[day].orders += 1
          ordersByDay[day].revenue += Number(r.total)
        }
        return {
          data: {
            totalOrders: all.length,
            deliveredOrders: delivered.length,
            cancelledOrders: all.filter((r) => r.state === 'CANCELLED').length,
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            avgOrderValue: delivered.length > 0 ? Math.round((totalRevenue / delivered.length) * 100) / 100 : 0,
            ordersByType: byType,
            ordersByPayment: byPayment,
            ordersByDay,
          },
        }
      }

      case ReportType.MENU_DATA: {
        let rq = supabase
          .from('receipts')
          .select('id, franchise_id')
          .eq('restaurant_id', restaurantId)
          .eq('state', 'DELIVERED')
          .gte('created_at', start)
          .lte('created_at', end)
        if (body.franchiseId) rq = rq.eq('franchise_id', body.franchiseId)
        const { data: receipts } = await rq
        const rids = (receipts ?? []).map((r) => r.id)
        if (rids.length === 0) return { data: { items: [] } }

        const { data: items } = await supabase
          .from('receipt_items')
          .select('item_id, name, name_arabic, price, quantity')
          .in('receipt_id', rids)

        const agg: Record<string, { name: string; name_arabic: string | null; quantity: number; revenue: number }> = {}
        for (const ri of items ?? []) {
          const key = String(ri.item_id ?? ri.name)
          if (!agg[key]) agg[key] = { name: ri.name, name_arabic: ri.name_arabic, quantity: 0, revenue: 0 }
          agg[key].quantity += ri.quantity
          agg[key].revenue += Number(ri.price) * ri.quantity
        }
        return {
          data: {
            items: Object.entries(agg)
              .map(([id, v]) => ({ itemId: id, ...v, revenue: Math.round(v.revenue * 100) / 100 }))
              .sort((a, b) => b.quantity - a.quantity)
              .slice(0, 100),
          },
        }
      }

      case ReportType.FEEDBACK_DATA: {
        let fq = supabase
          .from('feedback')
          .select('id, rating, franchise_id, created_at')
          .eq('restaurant_id', restaurantId)
          .gte('created_at', start)
          .lte('created_at', end)
        if (body.franchiseId) fq = fq.eq('franchise_id', body.franchiseId)
        const { data: fb } = await fq
        const all = fb ?? []
        const total = all.length
        const avg = total > 0 ? all.reduce((s, f) => s + f.rating, 0) / total : 0
        const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        for (const f of all) dist[f.rating] = (dist[f.rating] ?? 0) + 1
        return {
          data: {
            totalFeedback: total,
            averageRating: Math.round(avg * 100) / 100,
            distribution: dist,
          },
        }
      }

      case ReportType.CUSTOMER_DATA: {
        const { count: total } = await supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', restaurantId)

        const { count: newCount } = await supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', restaurantId)
          .gte('created_at', start)
          .lte('created_at', end)

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
          data: {
            totalCustomers: total ?? 0,
            newCustomers: newCount ?? 0,
            repeatCustomers,
          },
        }
      }

      case ReportType.LOYALTY_DATA: {
        let tq = supabase
          .from('loyalty_transactions')
          .select('id, type, points, created_at')
          .eq('restaurant_id', restaurantId)
          .gte('created_at', start)
          .lte('created_at', end)
        const { data: txs } = await tq
        const all = txs ?? []
        let earned = 0
        let redeemed = 0
        let adjusted = 0
        for (const t of all) {
          if (t.type === 'earn') earned += t.points
          else if (t.type === 'redeem') redeemed += Math.abs(t.points)
          else if (t.type === 'adjust') adjusted += t.points
        }
        return {
          data: {
            totalTransactions: all.length,
            pointsEarned: earned,
            pointsRedeemed: redeemed,
            pointsAdjusted: adjusted,
          },
        }
      }

      default:
        return reply.status(400).send({ error: 'Unknown reportType' })
    }
  })
}
