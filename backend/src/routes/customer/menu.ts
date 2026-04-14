import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabase } from '../../config/supabase'
import { NotFoundError } from '../../lib/errors'

export default async function customerMenuRoutes(fastify: FastifyInstance) {
  // GET /restaurant/:id  — full restaurant + menu (tenant-agnostic, uses path param)
  fastify.get('/restaurant/:id', async (request, reply) => {
    const { id } = z.object({ id: z.coerce.number().int() }).parse(request.params)

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, name, name_arabic, background_img, logo_url, preferred_country, is_foodics, config, menu_version, main_franchise_id')
      .eq('id', id)
      .single()

    if (!restaurant) throw new NotFoundError('Restaurant not found')

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

  // GET /category/details/:restaurantId  — all categories with items and addons
  fastify.get('/category/details/:restaurantId', async (request) => {
    const { restaurantId } = z.object({ restaurantId: z.coerce.number().int() }).parse(request.params)

    const { data: categories } = await supabase
      .from('categories')
      .select('id, name, name_arabic, image_url, sort_order, is_active')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('sort_order')

    if (!categories || categories.length === 0) return { categories: [] }

    const catIds = categories.map((c) => c.id)

    // Items
    const { data: items } = await supabase
      .from('items')
      .select('id, category_id, parent_item_id, name, name_arabic, description, description_arabic, price, image_url, sort_order, is_active, is_top_product, calories')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .in('category_id', catIds)
      .order('sort_order')

    const itemIds = (items ?? []).map((i) => i.id)

    // Addon groups + values
    let addonGroups: any[] = []
    let addonValues: any[] = []

    if (itemIds.length > 0) {
      const { data: groups } = await supabase
        .from('addon_groups')
        .select('id, item_id, name, name_arabic, is_required, min_select, max_select, sort_order')
        .eq('restaurant_id', restaurantId)
        .in('item_id', itemIds)
        .order('sort_order')

      addonGroups = groups ?? []

      const groupIds = addonGroups.map((g) => g.id)
      if (groupIds.length > 0) {
        const { data: values } = await supabase
          .from('addon_values')
          .select('id, addon_group_id, name, name_arabic, price, is_active, sort_order')
          .eq('restaurant_id', restaurantId)
          .in('addon_group_id', groupIds)
          .eq('is_active', true)
          .order('sort_order')

        addonValues = values ?? []
      }
    }

    // Build lookup maps
    const groupsByItem: Record<number, any[]> = {}
    for (const g of addonGroups) {
      if (!groupsByItem[g.item_id]) groupsByItem[g.item_id] = []
      groupsByItem[g.item_id].push(g)
    }

    const valuesByGroup: Record<number, any[]> = {}
    for (const v of addonValues) {
      if (!valuesByGroup[v.addon_group_id]) valuesByGroup[v.addon_group_id] = []
      valuesByGroup[v.addon_group_id].push(v)
    }

    const allItems = items ?? []

    // Attach addons to items
    const itemsWithAddons = allItems.map((item) => ({
      ...item,
      addonGroups: (groupsByItem[item.id] ?? []).map((g) => ({
        ...g,
        values: valuesByGroup[g.id] ?? [],
      })),
      subItems: allItems.filter((si) => si.parent_item_id === item.id),
    }))

    // Attach items to categories
    const result = categories.map((cat) => ({
      ...cat,
      items: itemsWithAddons.filter((i) => i.category_id === cat.id && !i.parent_item_id),
    }))

    return { categories: result }
  })

  // GET /items/item/:id  — single item detail
  fastify.get('/items/item/:id', async (request, reply) => {
    const restaurantId = request.restaurantId
    const { id } = z.object({ id: z.coerce.number().int() }).parse(request.params)

    const whereClause = restaurantId
      ? supabase.from('items').select('id, name, name_arabic, description, description_arabic, price, image_url, calories, category_id, is_active').eq('id', id).eq('restaurant_id', restaurantId)
      : supabase.from('items').select('id, name, name_arabic, description, description_arabic, price, image_url, calories, category_id, is_active').eq('id', id)

    const { data: item } = await whereClause.single()
    if (!item) throw new NotFoundError('Item not found')

    const { data: groups } = await supabase
      .from('addon_groups')
      .select('id, name, name_arabic, is_required, min_select, max_select, sort_order')
      .eq('item_id', id)
      .order('sort_order')

    const groupIds = (groups ?? []).map((g) => g.id)
    let addonValues: any[] = []
    if (groupIds.length > 0) {
      const { data: values } = await supabase
        .from('addon_values')
        .select('id, addon_group_id, name, name_arabic, price, sort_order')
        .in('addon_group_id', groupIds)
        .eq('is_active', true)
        .order('sort_order')
      addonValues = values ?? []
    }

    const valuesByGroup: Record<number, any[]> = {}
    for (const v of addonValues) {
      if (!valuesByGroup[v.addon_group_id]) valuesByGroup[v.addon_group_id] = []
      valuesByGroup[v.addon_group_id].push(v)
    }

    return {
      item: {
        ...item,
        addonGroups: (groups ?? []).map((g) => ({
          ...g,
          values: valuesByGroup[g.id] ?? [],
        })),
      },
    }
  })

  // GET /items/status  — check item availability
  //
  // Accepts two contracts:
  //   1. Canonical: `?ids=1,2,3` — returns statuses for just those IDs
  //   2. Storefront: `?restaurantId=X[&franchiseSlug=Y]` — returns statuses for
  //      every item in the restaurant (franchiseSlug is currently ignored; per-
  //      branch availability is not yet modelled in the schema)
  fastify.get('/items/status', async (request) => {
    const q = z.object({
      ids: z.string().optional(),
      restaurantId: z.coerce.number().int().optional(),
      franchiseSlug: z.string().optional(),
    }).parse(request.query)

    if (q.ids) {
      const ids = q.ids.split(',').map(Number).filter((n) => !isNaN(n))
      if (ids.length === 0) return { statuses: [] }

      const { data: items } = await supabase
        .from('items')
        .select('id, is_active')
        .in('id', ids)

      return {
        statuses: (items ?? []).map((i) => ({ id: i.id, isActive: i.is_active })),
      }
    }

    if (q.restaurantId) {
      const { data: items } = await supabase
        .from('items')
        .select('id, is_active')
        .eq('restaurant_id', q.restaurantId)

      return {
        statuses: (items ?? []).map((i) => ({ id: i.id, isActive: i.is_active })),
      }
    }

    return { statuses: [] }
  })

  // GET /items/top-products/:restaurantId
  fastify.get('/items/top-products/:restaurantId', async (request) => {
    const { restaurantId } = z.object({ restaurantId: z.coerce.number().int() }).parse(request.params)

    const { data: items } = await supabase
      .from('items')
      .select('id, name, name_arabic, price, image_url, category_id')
      .eq('restaurant_id', restaurantId)
      .eq('is_top_product', true)
      .eq('is_active', true)
      .order('sort_order')
      .limit(20)

    return { items: items ?? [] }
  })

  // GET /franchise/:id/offers  — package offers for a franchise
  fastify.get('/franchise/:id/offers', async (request) => {
    const { id } = z.object({ id: z.coerce.number().int() }).parse(request.params)

    const { data: offers } = await supabase
      .from('franchise_package_offers')
      .select('id, name, name_arabic, price, image_url, sort_order')
      .eq('franchise_id', id)
      .eq('is_active', true)
      .order('sort_order')

    return { offers: offers ?? [] }
  })

  // ── Compiled-storefront aliases ──────────────────────────────────────────────

  // GET /franchise/is-open?franchiseId=X
  // Storefront passes `franchiseId` as a query param; the canonical admin
  // route uses a path param and is mounted under /admin/v2. Expose a public
  // customer-level version here.
  fastify.get('/franchise/is-open', async (request, reply) => {
    const q = z.object({
      franchiseId: z.coerce.number().int(),
    }).parse(request.query)

    const { data: franchise } = await supabase
      .from('franchises')
      .select('id, is_online, busy_mode')
      .eq('id', q.franchiseId)
      .single()

    if (!franchise) return reply.status(404).send({ error: 'Franchise not found' })
    if (!franchise.is_online) return { isOpen: false, busyMode: false, reason: 'offline' }

    const now = new Date()
    const dayOfWeek = now.getDay()
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    const { data: slots } = await supabase
      .from('schedule_slots')
      .select('open_time, close_time')
      .eq('franchise_id', q.franchiseId)
      .eq('day_of_week', dayOfWeek)

    const isOpen = !slots || slots.length === 0 ||
      slots.some((s) => currentTime >= s.open_time && currentTime <= s.close_time)

    return {
      isOpen,
      busyMode: franchise.busy_mode,
      reason: isOpen ? null : 'closed',
    }
  })

}
