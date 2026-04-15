import type { FastifyInstance } from 'fastify'
import { supabase } from '../../config/supabase'
import { requireAdmin } from '../../middleware/auth'
import { z } from 'zod'

export default async function adminInfoRoutes(fastify: FastifyInstance) {
  // GET /info — return restaurant + franchises for the logged-in admin
  fastify.get('/info', { preHandler: requireAdmin }, async (request, reply) => {
    const restaurantId = request.admin!.restaurant_id

    const { data: restaurant, error } = await supabase
      .from('restaurants')
      .select('id, name, name_arabic, background_img, logo_url, preferred_country, is_foodics, main_franchise_id, config, menu_version')
      .eq('id', restaurantId)
      .single()

    if (error || !restaurant) {
      return reply.status(404).send({ error: 'Restaurant not found' })
    }

    const { data: franchises } = await supabase
      .from('franchises')
      .select('id, name, name_arabic, slug, address, is_online, busy_mode')
      .eq('restaurant_id', restaurantId)
      .order('id')

    // Match the exact shape the admin frontend expects
    return {
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        backgroundImg: restaurant.background_img,
        logoUrl: restaurant.logo_url,
        preferredCountry: restaurant.preferred_country,
        isFoodicsRestaurant: restaurant.is_foodics,
        config: restaurant.config || {},
        mainFranchiseId: restaurant.main_franchise_id,
      },
      franchises: (franchises || []).map((f) => ({
        id: f.id,
        name: f.name,
        name_arabic: f.name_arabic,
        slug: f.slug,
        address: f.address,
        isOnline: f.is_online,
        busyMode: f.busy_mode,
      })),
    }
  })

  // POST /restaurant/admin-analytics — track admin UI events
  fastify.post('/restaurant/admin-analytics', { preHandler: requireAdmin }, async (request) => {
    const body = z.object({
      event: z.string().min(1).max(100).regex(/^[\w:.\-/ ]+$/, 'Invalid event name'),
      restaurantId: z.number().optional(),
    }).parse(request.body)

    await supabase.from('admin_analytics').insert({
      restaurant_id: request.admin!.restaurant_id,
      admin_id: request.admin!.admin_id,
      event: body.event,
    })

    return { success: true }
  })

  // GET /admin/v2/restaurant/:id
  // Admin bundle calls this under the /admin/v2 prefix; the customer storefront
  // hits the same-named route at the root. Provide an admin-level version so
  // the admin dashboard's "Restaurant" page loads without a 404.
  fastify.get('/restaurant/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const adminRestaurantId = request.admin!.restaurant_id
    const { id } = z.object({ id: z.coerce.number().int() }).parse(request.params)

    // Admins can only load their own restaurant
    if (id !== adminRestaurantId) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, name, name_arabic, background_img, logo_url, preferred_country, is_foodics, config, menu_version, main_franchise_id')
      .eq('id', id)
      .single()

    if (!restaurant) return reply.status(404).send({ error: 'Restaurant not found' })

    const { data: franchises } = await supabase
      .from('franchises')
      .select('id, name, name_arabic, slug, address, lat, lng, is_online, busy_mode')
      .eq('restaurant_id', id)
      .order('id')

    return {
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        nameArabic: restaurant.name_arabic,
        backgroundImg: restaurant.background_img,
        logoUrl: restaurant.logo_url,
        preferredCountry: restaurant.preferred_country,
        isFoodicsRestaurant: restaurant.is_foodics,
        config: restaurant.config ?? {},
        menuVersion: restaurant.menu_version,
        mainFranchiseId: restaurant.main_franchise_id,
      },
      franchises: (franchises ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        nameArabic: f.name_arabic,
        slug: f.slug,
        address: f.address,
        lat: f.lat,
        lng: f.lng,
        isOnline: f.is_online,
        busyMode: f.busy_mode,
      })),
    }
  })
}
