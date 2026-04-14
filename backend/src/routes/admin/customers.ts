import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabase } from '../../config/supabase'
import { requireAdmin } from '../../middleware/auth'

export default async function adminCustomersRoutes(fastify: FastifyInstance) {
  // GET /customers/list
  fastify.get('/customers/list', { preHandler: requireAdmin }, async (request) => {
    const restaurantId = request.admin!.restaurant_id
    const q = z.object({
      search: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
    }).parse(request.query)

    const from = (q.page - 1) * q.pageSize
    const to = from + q.pageSize - 1

    let query = supabase
      .from('customers')
      .select('id, phone_number, person_name, email, points, referral_code, created_at', { count: 'exact' })
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (q.search) {
      query = query.or(`phone_number.ilike.%${q.search}%,person_name.ilike.%${q.search}%`)
    }

    const { data, count } = await query

    return {
      customers: data ?? [],
      total: count ?? 0,
      page: q.page,
      pageSize: q.pageSize,
    }
  })

  // GET /customers/:customerId
  fastify.get('/customers/:customerId', { preHandler: requireAdmin }, async (request, reply) => {
    const restaurantId = request.admin!.restaurant_id
    const { customerId } = z.object({ customerId: z.string().uuid() }).parse(request.params)

    const { data: customer } = await supabase
      .from('customers')
      .select('id, phone_number, person_name, email, points, referral_code, created_at')
      .eq('id', customerId)
      .eq('restaurant_id', restaurantId)
      .single()

    if (!customer) return reply.status(404).send({ error: 'Customer not found' })

    // Recent orders
    const { data: orders } = await supabase
      .from('receipts')
      .select('id, order_number, state, total, created_at, franchise_id')
      .eq('customer_id', customerId)
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(10)

    // Loyalty transactions
    const { data: loyalty } = await supabase
      .from('loyalty_transactions')
      .select('id, type, points, balance_after, created_at')
      .eq('customer_id', customerId)
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(20)

    return { customer, orders: orders ?? [], loyalty: loyalty ?? [] }
  })

  // POST /customers/:customerId/adjust-points
  fastify.post('/customers/:customerId/adjust-points', { preHandler: requireAdmin }, async (request, reply) => {
    const restaurantId = request.admin!.restaurant_id
    const { customerId } = z.object({ customerId: z.string().uuid() }).parse(request.params)
    const body = z.object({
      points: z.number().int(),  // positive or negative
      reason: z.string().optional(),
    }).parse(request.body)

    // Verify customer belongs to this restaurant
    const { data: customer } = await supabase
      .from('customers')
      .select('id, points')
      .eq('id', customerId)
      .eq('restaurant_id', restaurantId)
      .single()

    if (!customer) return reply.status(404).send({ error: 'Customer not found' })

    const newBalance = customer.points + body.points
    if (newBalance < 0) return reply.status(400).send({ error: 'Points balance cannot go negative' })

    await supabase
      .from('customers')
      .update({ points: newBalance, updated_at: new Date().toISOString() })
      .eq('id', customerId)

    await supabase.from('loyalty_transactions').insert({
      customer_id: customerId,
      restaurant_id: restaurantId,
      type: 'adjust',
      points: body.points,
      balance_after: newBalance,
    })

    return { success: true, newBalance }
  })

  // GET /customers/:customerId/orders
  fastify.get('/customers/:customerId/orders', { preHandler: requireAdmin }, async (request, reply) => {
    const restaurantId = request.admin!.restaurant_id
    const { customerId } = z.object({ customerId: z.string().uuid() }).parse(request.params)
    const q = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
    }).parse(request.query)

    const { data: owner } = await supabase
      .from('customers')
      .select('id')
      .eq('id', customerId)
      .eq('restaurant_id', restaurantId)
      .single()

    if (!owner) return reply.status(404).send({ error: 'Customer not found' })

    const from = (q.page - 1) * q.pageSize
    const to = from + q.pageSize - 1

    const { data, count } = await supabase
      .from('receipts')
      .select('id, order_number, state, order_type, total, created_at, franchise_id', { count: 'exact' })
      .eq('customer_id', customerId)
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .range(from, to)

    return {
      orders: data ?? [],
      total: count ?? 0,
      page: q.page,
      pageSize: q.pageSize,
    }
  })

  // ── Compiled-admin aliases under /customerprofiles/* ─────────────────────────

  // GET /customerprofiles/all-users — alias of /customers/list
  fastify.get('/customerprofiles/all-users', { preHandler: requireAdmin }, async (request) => {
    const restaurantId = request.admin!.restaurant_id
    const q = z.object({
      search: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
    }).passthrough().parse(request.query)

    const from = (q.page - 1) * q.pageSize
    const to = from + q.pageSize - 1

    let query = supabase
      .from('customers')
      .select('id, phone_number, person_name, email, points, referral_code, created_at', { count: 'exact' })
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (q.search) {
      query = query.or(`phone_number.ilike.%${q.search}%,person_name.ilike.%${q.search}%`)
    }

    const { data, count } = await query

    return {
      customers: data ?? [],
      total: count ?? 0,
      page: q.page,
      pageSize: q.pageSize,
    }
  })

  // POST /customerprofiles/all-receipts — alias of GET /customers/:id/orders
  fastify.post('/customerprofiles/all-receipts', { preHandler: requireAdmin }, async (request, reply) => {
    const restaurantId = request.admin!.restaurant_id
    const body = z.object({
      customerId: z.string().uuid(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
    }).passthrough().parse(request.body)

    const { data: owner } = await supabase
      .from('customers')
      .select('id')
      .eq('id', body.customerId)
      .eq('restaurant_id', restaurantId)
      .single()

    if (!owner) return reply.status(404).send({ error: 'Customer not found' })

    const from = (body.page - 1) * body.pageSize
    const to = from + body.pageSize - 1

    const { data, count } = await supabase
      .from('receipts')
      .select('id, order_number, state, order_type, total, created_at, franchise_id', { count: 'exact' })
      .eq('customer_id', body.customerId)
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .range(from, to)

    return {
      orders: data ?? [],
      total: count ?? 0,
      page: body.page,
      pageSize: body.pageSize,
    }
  })

  // POST /customerprofiles/customer-details — alias of GET /customers/:id
  fastify.post('/customerprofiles/customer-details', { preHandler: requireAdmin }, async (request, reply) => {
    const restaurantId = request.admin!.restaurant_id
    const body = z.object({
      customerId: z.string().uuid(),
    }).passthrough().parse(request.body)

    const { data: customer } = await supabase
      .from('customers')
      .select('id, phone_number, person_name, email, points, referral_code, created_at')
      .eq('id', body.customerId)
      .eq('restaurant_id', restaurantId)
      .single()

    if (!customer) return reply.status(404).send({ error: 'Customer not found' })

    const { data: orders } = await supabase
      .from('receipts')
      .select('id, order_number, state, total, created_at, franchise_id')
      .eq('customer_id', body.customerId)
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(10)

    const { data: loyalty } = await supabase
      .from('loyalty_transactions')
      .select('id, type, points, balance_after, created_at')
      .eq('customer_id', body.customerId)
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(20)

    return { customer, orders: orders ?? [], loyalty: loyalty ?? [] }
  })

  // POST /customerprofiles/pagination — total page count for a given page size
  fastify.post('/customerprofiles/pagination', { preHandler: requireAdmin }, async (request) => {
    const restaurantId = request.admin!.restaurant_id
    const body = z.object({
      search: z.string().optional(),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
    }).passthrough().parse(request.body ?? {})

    let query = supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)

    if (body.search) {
      query = query.or(`phone_number.ilike.%${body.search}%,person_name.ilike.%${body.search}%`)
    }

    const { count } = await query
    const total = count ?? 0
    const pages = Math.max(1, Math.ceil(total / body.pageSize))

    return { total, pages, pageSize: body.pageSize }
  })
}
