import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabase } from '../../config/supabase'
import { requireCustomer, optionalCustomer } from '../../middleware/auth'
import { AppError, NotFoundError, ForbiddenError } from '../../lib/errors'
import { getPointingSystem, calculatePointsEarned, calculateRedeemDiscount, awardPoints, redeemPoints } from '../../services/points'
import { initiatePayment } from '../../services/paymob'
import { notifyOrderPlaced } from '../../services/whatsapp'
import { OrderType, PaymentMethod, ReceiptState } from '../../types'

// ── Schema for a single cart item ─────────────────────────────────────────────
const cartItemSchema = z.object({
  itemId: z.number().int(),
  name: z.string(),
  nameArabic: z.string().optional(),
  price: z.number().min(0),
  quantity: z.number().int().positive(),
  addons: z.array(z.object({
    name: z.string(),
    nameArabic: z.string().optional(),
    price: z.number().min(0),
    quantity: z.number().int().positive().default(1),
  })).default([]),
  notes: z.string().optional(),
})

const confirmReceiptBody = z.object({
  restaurantId: z.number().int().positive(),
  franchiseId: z.number().int().positive(),
  orderType: z.nativeEnum(OrderType),
  paymentMethod: z.nativeEnum(PaymentMethod),
  items: z.array(cartItemSchema).min(1),
  notes: z.string().optional(),
  addressId: z.number().int().optional(),
  deliveryFee: z.number().min(0).default(0),
  discount: z.number().min(0).default(0),
  promoCode: z.string().optional(),
  pointsToRedeem: z.number().int().min(0).default(0),
  tableNumber: z.string().optional(),
})

export default async function customerOrdersRoutes(fastify: FastifyInstance) {
  // POST /receipt/confirm  — place an order
  fastify.post('/receipt/confirm', { preHandler: optionalCustomer }, async (request, reply) => {
    const body = confirmReceiptBody.parse(request.body)
    const customerId = request.customer?.customer_id ?? null

    // Verify franchise belongs to restaurant and is online
    const { data: franchise } = await supabase
      .from('franchises')
      .select('id, restaurant_id, is_online')
      .eq('id', body.franchiseId)
      .eq('restaurant_id', body.restaurantId)
      .single()

    if (!franchise) throw new NotFoundError('Franchise not found')
    if (!franchise.is_online) throw new AppError(400, 'This branch is currently offline')

    // Validate promo code if provided
    let promoDiscount = 0
    let promoCodeRecord = null
    if (body.promoCode) {
      const { data: promo } = await supabase
        .from('promo_codes')
        .select('id, promo_type, value, min_order, max_uses, uses_count, per_customer, expires_at')
        .eq('restaurant_id', body.restaurantId)
        .eq('code', body.promoCode.toUpperCase())
        .eq('is_active', true)
        .single()

      if (!promo) throw new AppError(400, 'Invalid promo code')
      if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
        throw new AppError(400, 'Promo code has expired')
      }
      if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) {
        throw new AppError(400, 'Promo code has reached its usage limit')
      }

      // Calculate subtotal to check min_order
      const subtotalCheck = body.items.reduce((sum, item) => {
        const addonsTotal = item.addons.reduce((as, a) => as + a.price * a.quantity, 0)
        return sum + (item.price + addonsTotal) * item.quantity
      }, 0)

      if (subtotalCheck < promo.min_order) {
        throw new AppError(400, `Minimum order of ${promo.min_order} required for this promo`)
      }

      promoCodeRecord = promo
      if (promo.promo_type === 'percentage') {
        promoDiscount = Math.min(subtotalCheck * (promo.value / 100), subtotalCheck)
      } else if (promo.promo_type === 'fixed') {
        promoDiscount = Math.min(promo.value, subtotalCheck)
      } else if (promo.promo_type === 'free_delivery') {
        promoDiscount = body.deliveryFee
      }
    }

    // Calculate totals
    const subtotal = body.items.reduce((sum, item) => {
      const addonsTotal = item.addons.reduce((as, a) => as + a.price * a.quantity, 0)
      return sum + (item.price + addonsTotal) * item.quantity
    }, 0)

    // Points redemption validation
    let pointsRedeemDiscount = 0
    let pointingSystem = null
    if (body.pointsToRedeem > 0 && customerId) {
      pointingSystem = await getPointingSystem(body.restaurantId)
      if (pointingSystem) {
        pointsRedeemDiscount = calculateRedeemDiscount(body.pointsToRedeem, pointingSystem)

        // Verify customer has enough points
        const { data: cust } = await supabase
          .from('customers')
          .select('points')
          .eq('id', customerId)
          .single()

        if (!cust || cust.points < body.pointsToRedeem) {
          throw new AppError(400, 'Insufficient loyalty points')
        }
      }
    }

    const totalDiscount = body.discount + promoDiscount + pointsRedeemDiscount
    const total = Math.max(0, subtotal + body.deliveryFee - totalDiscount)

    // Resolve address snapshot for delivery orders
    let addressSnapshot = null
    if (body.orderType === OrderType.DELIVERY && body.addressId && customerId) {
      const { data: addr } = await supabase
        .from('delivery_addresses')
        .select('address_line, area, lat, lng')
        .eq('id', body.addressId)
        .eq('customer_id', customerId)
        .single()
      if (addr) addressSnapshot = addr
    }

    // Generate order number (per franchise, reset daily — simple approach: count today's orders)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const { count: todayCount } = await supabase
      .from('receipts')
      .select('id', { count: 'exact', head: true })
      .eq('franchise_id', body.franchiseId)
      .gte('created_at', todayStart.toISOString())

    const orderNumber = (todayCount ?? 0) + 1

    // Create the receipt
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .insert({
        restaurant_id: body.restaurantId,
        franchise_id: body.franchiseId,
        customer_id: customerId,
        order_number: orderNumber,
        state: ReceiptState.PENDING,
        order_type: body.orderType,
        payment_method: body.paymentMethod,
        subtotal: Math.round(subtotal * 100) / 100,
        delivery_fee: body.deliveryFee,
        discount: body.discount,
        total: Math.round(total * 100) / 100,
        notes: body.notes ?? null,
        address_snapshot: addressSnapshot,
        points_redeemed: body.pointsToRedeem,
        promo_code: body.promoCode?.toUpperCase() ?? null,
        promo_discount: promoDiscount,
        table_number: body.tableNumber ?? null,
        is_paid: body.paymentMethod === PaymentMethod.CASH || body.paymentMethod === PaymentMethod.POS,
      })
      .select('id')
      .single()

    if (receiptError || !receipt) throw new AppError(500, 'Failed to create order')

    // Insert receipt items
    const receiptItemsData = body.items.map((item) => ({
      receipt_id: receipt.id,
      item_id: item.itemId,
      name: item.name,
      name_arabic: item.nameArabic ?? null,
      price: item.price,
      quantity: item.quantity,
      addons: item.addons,
      notes: item.notes ?? null,
    }))
    await supabase.from('receipt_items').insert(receiptItemsData)

    // Process points redemption
    if (body.pointsToRedeem > 0 && customerId) {
      await redeemPoints(customerId, body.restaurantId, receipt.id, body.pointsToRedeem)
    }

    // Award loyalty points for CASH/POS orders (online payment is awarded after webhook confirmation)
    if ((body.paymentMethod === PaymentMethod.CASH || body.paymentMethod === PaymentMethod.POS) && customerId) {
      if (!pointingSystem) pointingSystem = await getPointingSystem(body.restaurantId)
      if (pointingSystem) {
        const pointsEarned = calculatePointsEarned(total, pointingSystem)
        if (pointsEarned > 0) {
          await awardPoints(customerId, body.restaurantId, receipt.id, pointsEarned)
          await supabase.from('receipts').update({ points_earned: pointsEarned }).eq('id', receipt.id)
        }
      }
    }

    // Increment promo usage
    if (promoCodeRecord) {
      await supabase
        .from('promo_codes')
        .update({ uses_count: promoCodeRecord.uses_count + 1 })
        .eq('id', promoCodeRecord.id)
    }

    // Emit Socket.IO events to franchise and admin dashboards
    const io = (fastify as any).io
    if (io) {
      const orderPayload = {
        receiptId: receipt.id,
        orderNumber,
        franchiseId: body.franchiseId,
        orderType: body.orderType,
        total: Math.round(total * 100) / 100,
      }
      io.of('/socket/franchise').to(`franchise:${body.franchiseId}`).emit('new_order', orderPayload)
      io.of('/socket/admin').to(`admin:${body.restaurantId}`).emit('new_order', orderPayload)
    }

    // WhatsApp notification (fire and forget)
    if (customerId && request.customer?.phone_number) {
      notifyOrderPlaced(request.customer.phone_number, orderNumber).catch(() => {})
    }

    // If online payment, initiate Paymob
    if (body.paymentMethod === PaymentMethod.ONLINE_CARD || body.paymentMethod === PaymentMethod.ONLINE) {
      try {
        const payment = await initiatePayment({
          amountCents: Math.round(total * 100),
          orderId: receipt.id,
          customerPhone: request.customer?.phone_number ?? '',
          customerName: request.customer?.person_name ?? 'Customer',
          customerEmail: '',
        })

        await supabase
          .from('receipts')
          .update({ paymob_order_id: String(payment.orderId) })
          .eq('id', receipt.id)

        return {
          receiptId: receipt.id,
          orderNumber,
          paymentRequired: true,
          paymobIframeUrl: `https://accept.paymob.com/api/acceptance/iframes/${payment.iframeId}?payment_token=${payment.paymentKey}`,
        }
      } catch (err: any) {
        fastify.log.error({ err }, 'Paymob initiation failed')
        // Still return order — payment can be retried
        return {
          receiptId: receipt.id,
          orderNumber,
          paymentRequired: true,
          paymobError: 'Payment gateway error — please retry',
        }
      }
    }

    return { receiptId: receipt.id, orderNumber, paymentRequired: false }
  })

  // GET /receipt/:id  — fetch single receipt detail
  fastify.get('/receipt/:id', { preHandler: requireCustomer }, async (request, reply) => {
    const customerId = request.customer!.customer_id
    const restaurantId = request.customer!.restaurant_id
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)

    const { data: receipt } = await supabase
      .from('receipts')
      .select('*, receipt_items(*)')
      .eq('id', id)
      .single()

    if (!receipt) throw new NotFoundError('Order not found')

    // Customers can only see their own orders or orders from same restaurant
    if (receipt.customer_id !== customerId && receipt.restaurant_id !== restaurantId) {
      throw new ForbiddenError()
    }

    return { receipt }
  })

  // GET /receipt/list  — customer order history
  fastify.get('/receipt/list', { preHandler: requireCustomer }, async (request) => {
    const customerId = request.customer!.customer_id
    const restaurantId = request.customer!.restaurant_id
    const q = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(50).default(10),
    }).parse(request.query)

    const from = (q.page - 1) * q.pageSize
    const to = from + q.pageSize - 1

    const { data, count } = await supabase
      .from('receipts')
      .select('id, order_number, state, order_type, total, created_at, franchise_id', { count: 'exact' })
      .eq('customer_id', customerId)
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .range(from, to)

    return { orders: data ?? [], total: count ?? 0, page: q.page, pageSize: q.pageSize }
  })

  // GET /receipt/:id/track  — real-time order tracking info
  fastify.get('/receipt/:id/track', { preHandler: optionalCustomer }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)

    const { data: receipt } = await supabase
      .from('receipts')
      .select('id, order_number, state, order_type, estimated_minutes, franchise_id, restaurant_id, created_at, updated_at')
      .eq('id', id)
      .single()

    if (!receipt) throw new NotFoundError('Order not found')

    return {
      receiptId: receipt.id,
      orderNumber: receipt.order_number,
      state: receipt.state,
      orderType: receipt.order_type,
      estimatedMinutes: receipt.estimated_minutes,
      updatedAt: receipt.updated_at,
    }
  })

  // POST /receipt/:id/feedback  — submit feedback after order
  fastify.post('/receipt/:id/feedback', { preHandler: requireCustomer }, async (request, reply) => {
    const customerId = request.customer!.customer_id
    const restaurantId = request.customer!.restaurant_id
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const body = z.object({
      rating: z.number().int().min(1).max(5),
      comment: z.string().optional(),
    }).parse(request.body)

    const { data: receipt } = await supabase
      .from('receipts')
      .select('id, franchise_id, state')
      .eq('id', id)
      .eq('customer_id', customerId)
      .single()

    if (!receipt) throw new NotFoundError('Order not found')

    await supabase.from('feedback').insert({
      restaurant_id: restaurantId,
      franchise_id: receipt.franchise_id,
      customer_id: customerId,
      receipt_id: id,
      rating: body.rating,
      comment: body.comment ?? null,
    })

    return { success: true }
  })
}
