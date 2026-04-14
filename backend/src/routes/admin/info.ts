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
      event: z.string(),
      restaurantId: z.number().optional(),
    }).parse(request.body)

    await supabase.from('admin_analytics').insert({
      restaurant_id: request.admin!.restaurant_id,
      admin_id: request.admin!.admin_id,
      event: body.event,
    })

    return { success: true }
  })
}
