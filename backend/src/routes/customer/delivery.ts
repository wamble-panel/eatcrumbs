import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabase } from '../../config/supabase'
import { requireCustomer } from '../../middleware/auth'
import { NotFoundError, ForbiddenError } from '../../lib/errors'

const addressBody = z.object({
  label: z.string().optional(),
  addressLine: z.string().min(1),
  area: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  isDefault: z.boolean().default(false),
})

export default async function customerDeliveryRoutes(fastify: FastifyInstance) {
  // GET /delivery/addresses  — list saved addresses
  fastify.get('/delivery/addresses', { preHandler: requireCustomer }, async (request) => {
    const customerId = request.customer!.customer_id
    const restaurantId = request.customer!.restaurant_id

    const { data } = await supabase
      .from('delivery_addresses')
      .select('id, label, address_line, area, lat, lng, is_default, created_at')
      .eq('customer_id', customerId)
      .eq('restaurant_id', restaurantId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })

    return { addresses: data ?? [] }
  })

  // POST /delivery/addresses  — save a new address
  fastify.post('/delivery/addresses', { preHandler: requireCustomer }, async (request, reply) => {
    const customerId = request.customer!.customer_id
    const restaurantId = request.customer!.restaurant_id
    const body = addressBody.parse(request.body)

    // If marking as default, unset existing defaults
    if (body.isDefault) {
      await supabase
        .from('delivery_addresses')
        .update({ is_default: false })
        .eq('customer_id', customerId)
        .eq('restaurant_id', restaurantId)
    }

    const { data, error } = await supabase
      .from('delivery_addresses')
      .insert({
        customer_id: customerId,
        restaurant_id: restaurantId,
        label: body.label ?? null,
        address_line: body.addressLine,
        area: body.area ?? null,
        lat: body.lat ?? null,
        lng: body.lng ?? null,
        is_default: body.isDefault,
      })
      .select()
      .single()

    if (error) return reply.status(500).send({ error: error.message })
    return { address: data }
  })

  // PUT /delivery/addresses/:id  — update an address
  fastify.put('/delivery/addresses/:id', { preHandler: requireCustomer }, async (request, reply) => {
    const customerId = request.customer!.customer_id
    const restaurantId = request.customer!.restaurant_id
    const { id } = z.object({ id: z.coerce.number().int() }).parse(request.params)
    const body = addressBody.parse(request.body)

    // Verify ownership
    const { data: existing } = await supabase
      .from('delivery_addresses')
      .select('id')
      .eq('id', id)
      .eq('customer_id', customerId)
      .single()

    if (!existing) throw new NotFoundError('Address not found')

    if (body.isDefault) {
      await supabase
        .from('delivery_addresses')
        .update({ is_default: false })
        .eq('customer_id', customerId)
        .eq('restaurant_id', restaurantId)
    }

    const { data, error } = await supabase
      .from('delivery_addresses')
      .update({
        label: body.label ?? null,
        address_line: body.addressLine,
        area: body.area ?? null,
        lat: body.lat ?? null,
        lng: body.lng ?? null,
        is_default: body.isDefault,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return reply.status(500).send({ error: error.message })
    return { address: data }
  })

  // DELETE /delivery/addresses/:id
  fastify.delete('/delivery/addresses/:id', { preHandler: requireCustomer }, async (request, reply) => {
    const customerId = request.customer!.customer_id
    const { id } = z.object({ id: z.coerce.number().int() }).parse(request.params)

    const { data: existing } = await supabase
      .from('delivery_addresses')
      .select('id')
      .eq('id', id)
      .eq('customer_id', customerId)
      .single()

    if (!existing) throw new NotFoundError('Address not found')

    await supabase.from('delivery_addresses').delete().eq('id', id)
    return { success: true }
  })

  // POST /delivery/addresses/:id/set-default
  fastify.post('/delivery/addresses/:id/set-default', { preHandler: requireCustomer }, async (request, reply) => {
    const customerId = request.customer!.customer_id
    const restaurantId = request.customer!.restaurant_id
    const { id } = z.object({ id: z.coerce.number().int() }).parse(request.params)

    const { data: existing } = await supabase
      .from('delivery_addresses')
      .select('id')
      .eq('id', id)
      .eq('customer_id', customerId)
      .single()

    if (!existing) throw new NotFoundError('Address not found')

    // Unset all defaults, set this one
    await supabase
      .from('delivery_addresses')
      .update({ is_default: false })
      .eq('customer_id', customerId)
      .eq('restaurant_id', restaurantId)

    await supabase
      .from('delivery_addresses')
      .update({ is_default: true })
      .eq('id', id)

    return { success: true }
  })

  // ── Compiled-storefront aliases ──────────────────────────────────────────────
  // Storefront uses `/delivery/address` (singular), sends structured address
  // fields (streetName, buildingNumber, floorNumber, apartmentNumber,
  // addressTitle, additionalDetails) and uses POST-with-body for both
  // create/update and for delete.

  // Flattens the storefront's structured address into our single `address_line`.
  const storefrontAddressBody = z.object({
    id: z.number().int().optional(),
    area: z.string().optional(),
    streetName: z.string().optional(),
    buildingNumber: z.string().optional(),
    floorNumber: z.string().optional(),
    apartmentNumber: z.string().optional(),
    addressTitle: z.string().optional(),
    additionalDetails: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    deliveryTypeId: z.number().int().optional(),
    isDefault: z.boolean().optional(),
  }).passthrough()

  function buildAddressLine(body: z.infer<typeof storefrontAddressBody>): string {
    const parts = [
      body.streetName,
      body.buildingNumber && `Building ${body.buildingNumber}`,
      body.floorNumber && `Floor ${body.floorNumber}`,
      body.apartmentNumber && `Apt ${body.apartmentNumber}`,
      body.additionalDetails,
    ].filter(Boolean)
    return parts.join(', ') || body.additionalDetails || body.area || 'Unnamed address'
  }

  // GET /delivery/address  — singular alias of /delivery/addresses
  fastify.get('/delivery/address', { preHandler: requireCustomer }, async (request) => {
    const customerId = request.customer!.customer_id
    const restaurantId = request.customer!.restaurant_id

    const { data } = await supabase
      .from('delivery_addresses')
      .select('id, label, address_line, area, lat, lng, is_default, created_at')
      .eq('customer_id', customerId)
      .eq('restaurant_id', restaurantId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })

    return { addresses: data ?? [] }
  })

  // POST /delivery/address  — create OR update depending on presence of `id`
  fastify.post('/delivery/address', { preHandler: requireCustomer }, async (request, reply) => {
    const customerId = request.customer!.customer_id
    const restaurantId = request.customer!.restaurant_id
    const body = storefrontAddressBody.parse(request.body)

    const addressLine = buildAddressLine(body)
    const label = body.addressTitle ?? null

    // Update path
    if (body.id) {
      const { data: existing } = await supabase
        .from('delivery_addresses')
        .select('id')
        .eq('id', body.id)
        .eq('customer_id', customerId)
        .single()
      if (!existing) throw new NotFoundError('Address not found')

      if (body.isDefault) {
        await supabase
          .from('delivery_addresses')
          .update({ is_default: false })
          .eq('customer_id', customerId)
          .eq('restaurant_id', restaurantId)
      }

      const { data, error } = await supabase
        .from('delivery_addresses')
        .update({
          label,
          address_line: addressLine,
          area: body.area ?? null,
          lat: body.lat ?? null,
          lng: body.lng ?? null,
          is_default: body.isDefault ?? false,
        })
        .eq('id', body.id)
        .select()
        .single()

      if (error) return reply.status(500).send({ error: error.message })
      return { address: data }
    }

    // Create path
    if (body.isDefault) {
      await supabase
        .from('delivery_addresses')
        .update({ is_default: false })
        .eq('customer_id', customerId)
        .eq('restaurant_id', restaurantId)
    }

    const { data, error } = await supabase
      .from('delivery_addresses')
      .insert({
        customer_id: customerId,
        restaurant_id: restaurantId,
        label,
        address_line: addressLine,
        area: body.area ?? null,
        lat: body.lat ?? null,
        lng: body.lng ?? null,
        is_default: body.isDefault ?? false,
      })
      .select()
      .single()

    if (error) return reply.status(500).send({ error: error.message })
    return { address: data }
  })

  // POST /delivery/delete-address  — storefront uses POST-with-body instead of DELETE
  fastify.post('/delivery/delete-address', { preHandler: requireCustomer }, async (request) => {
    const customerId = request.customer!.customer_id
    const { addressId } = z.object({
      addressId: z.number().int(),
    }).parse(request.body)

    const { data: existing } = await supabase
      .from('delivery_addresses')
      .select('id')
      .eq('id', addressId)
      .eq('customer_id', customerId)
      .single()

    if (!existing) throw new NotFoundError('Address not found')

    await supabase.from('delivery_addresses').delete().eq('id', addressId)
    return { success: true }
  })
}
