import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabase } from '../../config/supabase'
import { requireAdmin } from '../../middleware/auth'
import { uploadItemImage } from '../../services/storage'
import { ForbiddenError } from '../../lib/errors'

// ── Helpers ──────────────────────────────────────────────────────────────────

async function assertCategoryOwner(restaurantId: number, categoryId: number) {
  const { data } = await supabase
    .from('categories')
    .select('id')
    .eq('id', categoryId)
    .eq('restaurant_id', restaurantId)
    .single()
  if (!data) throw new ForbiddenError('Category not found or access denied')
}

async function assertItemOwner(restaurantId: number, itemId: number) {
  const { data } = await supabase
    .from('items')
    .select('id')
    .eq('id', itemId)
    .eq('restaurant_id', restaurantId)
    .single()
  if (!data) throw new ForbiddenError('Item not found or access denied')
}

async function bumpMenuVersion(restaurantId: number) {
  const version = String(Date.now())
  await supabase.from('restaurants').update({ menu_version: version }).eq('id', restaurantId)
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const categoryBody = z.object({
  id: z.number().optional().nullable(),
  restaurantId: z.number(),
  category_name: z.string().min(1),
  category_name_arabic: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
})

const itemBody = z.object({
  id: z.number().optional().nullable(),
  restaurantId: z.number(),
  item_name: z.string().min(1),
  item_name_arabic: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  description_arabic: z.string().optional().nullable(),
  price: z.number().min(0),
  categoryId: z.number().optional().nullable(),
  visible: z.boolean().optional(),
  is_combo: z.boolean().optional(),
  calories: z.number().optional().nullable(),
  dietary_tags: z.array(z.string()).optional(),
  subItems: z.array(z.any()).optional(),
})

const addonGroupBody = z.object({
  id: z.number().optional().nullable(),
  restaurantId: z.number(),
  name: z.string().min(1),
  name_arabic: z.string().optional().nullable(),
  required: z.boolean().optional(),
  min: z.number().min(0).optional(),
  max: z.number().min(1).optional(),
  addonValues: z.array(z.object({
    id: z.number().optional().nullable(),
    name: z.string().min(1),
    name_arabic: z.string().optional().nullable(),
    price: z.number().min(0),
  })).optional(),
})

// ── Routes ────────────────────────────────────────────────────────────────────

export default async function adminMenuRoutes(fastify: FastifyInstance) {

  // ── CATEGORIES ─────────────────────────────────────────────────────────────

  fastify.get('/category/details/:restaurantId', { preHandler: requireAdmin }, async (req: any) => {
    const rid = parseInt(req.params.restaurantId)
    if (rid !== req.admin!.restaurant_id) throw new ForbiddenError()

    const { data: categories } = await supabase
      .from('categories')
      .select(`
        id, category_name, category_name_arabic, description, sort_order,
        items (
          id, item_name, item_name_arabic, description, price, image, images,
          is_visible, is_available, sort_order, is_combo, calories, dietary_tags,
          item_addon_groups (
            addon_group_id,
            addon_groups ( id, name, name_arabic, required, min_select, max_select,
              addon_values ( id, name, name_arabic, price, is_available )
            )
          ),
          sub_items!sub_items_parent_item_id_fkey (
            id, child_item_id, sort_order
          )
        )
      `)
      .eq('restaurant_id', rid)
      .is('deleted_at', null)
      .order('sort_order')

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, name, menu_version')
      .eq('id', rid)
      .single()

    return (categories || []).map((cat) => ({
      id: cat.id,
      category_name: cat.category_name,
      category_name_arabic: cat.category_name_arabic,
      description: cat.description,
      sort_order: cat.sort_order,
      restaurant: restaurant,
      itemCategories: (cat.items || []).map((item: any) => ({ item })),
    }))
  })

  fastify.post('/category', { preHandler: requireAdmin }, async (req: any) => {
    const body = categoryBody.parse(req.body)
    const restaurantId = req.admin!.restaurant_id
    if (body.restaurantId !== restaurantId) throw new ForbiddenError()

    const { data, error } = await supabase.from('categories').insert({
      restaurant_id: restaurantId,
      category_name: body.category_name,
      category_name_arabic: body.category_name_arabic,
      description: body.description,
    }).select().single()

    if (error) throw new Error(error.message)
    await bumpMenuVersion(restaurantId)
    return data
  })

  fastify.post('/category/edit', { preHandler: requireAdmin }, async (req: any) => {
    const body = categoryBody.parse(req.body)
    const restaurantId = req.admin!.restaurant_id
    if (body.restaurantId !== restaurantId) throw new ForbiddenError()
    if (body.id) await assertCategoryOwner(restaurantId, body.id)

    const { data, error } = await supabase.from('categories').update({
      category_name: body.category_name,
      category_name_arabic: body.category_name_arabic,
      description: body.description,
      updated_at: new Date().toISOString(),
    }).eq('id', body.id!).eq('restaurant_id', restaurantId).select().single()

    if (error) throw new Error(error.message)
    await bumpMenuVersion(restaurantId)
    return data
  })

  fastify.post('/category/delete', { preHandler: requireAdmin }, async (req: any) => {
    const body = z.object({ id: z.number(), restaurantId: z.number() }).parse(req.body)
    const restaurantId = req.admin!.restaurant_id
    if (body.restaurantId !== restaurantId) throw new ForbiddenError()
    await assertCategoryOwner(restaurantId, body.id)

    await supabase.from('categories').update({ deleted_at: new Date().toISOString() })
      .eq('id', body.id).eq('restaurant_id', restaurantId)

    await bumpMenuVersion(restaurantId)
    return { success: true }
  })

  fastify.post('/category/update-order', { preHandler: requireAdmin }, async (req: any) => {
    const body = z.object({
      restaurantId: z.number(),
      categories: z.array(z.object({ id: z.number(), order: z.number() })),
    }).parse(req.body)
    const restaurantId = req.admin!.restaurant_id
    if (body.restaurantId !== restaurantId) throw new ForbiddenError()

    for (const cat of body.categories) {
      await supabase.from('categories').update({ sort_order: cat.order })
        .eq('id', cat.id).eq('restaurant_id', restaurantId)
    }

    await bumpMenuVersion(restaurantId)
    return { success: true }
  })

  fastify.get('/category/time-availability', { preHandler: requireAdmin }, async (req: any) => {
    const restaurantId = req.admin!.restaurant_id
    const { data } = await supabase
      .from('category_time_availability')
      .select('*')
      .eq('restaurant_id', restaurantId)
    return data || []
  })

  fastify.post('/category/time-availability', { preHandler: requireAdmin }, async (req: any) => {
    const body = z.object({
      categoryId: z.number(),
      startTime: z.string(),
      endTime: z.string(),
      enabled: z.boolean(),
    }).parse(req.body)
    const restaurantId = req.admin!.restaurant_id
    await assertCategoryOwner(restaurantId, body.categoryId)

    const { data, error } = await supabase.from('category_time_availability').upsert({
      category_id: body.categoryId,
      restaurant_id: restaurantId,
      start_time: body.startTime,
      end_time: body.endTime,
      enabled: body.enabled,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'category_id' }).select().single()

    if (error) throw new Error(error.message)
    await bumpMenuVersion(restaurantId)
    return data
  })

  // ── ITEMS ──────────────────────────────────────────────────────────────────

  fastify.get('/item/list', { preHandler: requireAdmin }, async (req: any) => {
    const restaurantId = req.admin!.restaurant_id
    const isMenuItem = req.query?.isMenuItem === 'true'
    let query = supabase.from('items').select('*').eq('restaurant_id', restaurantId).is('deleted_at', null)
    if (isMenuItem) query = query.eq('is_combo', false)
    const { data } = await query.order('sort_order')
    return data || []
  })

  fastify.get('/item/subitem/list', { preHandler: requireAdmin }, async (req: any) => {
    const restaurantId = req.admin!.restaurant_id
    const { data } = await supabase
      .from('items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .is('deleted_at', null)
      .order('item_name')
    return data || []
  })

  fastify.post('/item', { preHandler: requireAdmin }, async (req: any) => {
    const body = itemBody.parse(req.body)
    const restaurantId = req.admin!.restaurant_id
    if (body.restaurantId !== restaurantId) throw new ForbiddenError()
    if (body.id) await assertItemOwner(restaurantId, body.id)

    const payload = {
      restaurant_id: restaurantId,
      category_id: body.categoryId,
      item_name: body.item_name,
      item_name_arabic: body.item_name_arabic,
      description: body.description,
      description_arabic: body.description_arabic,
      price: body.price,
      is_visible: body.visible ?? true,
      is_combo: body.is_combo ?? false,
      calories: body.calories,
      dietary_tags: body.dietary_tags ?? [],
      updated_at: new Date().toISOString(),
    }

    let data, error
    if (body.id) {
      ({ data, error } = await supabase.from('items').update(payload).eq('id', body.id).select().single())
    } else {
      ({ data, error } = await supabase.from('items').insert(payload).select().single())
    }
    if (error) throw new Error(error.message)

    // Sync sub-items (combos)
    if (body.subItems && body.id) {
      await supabase.from('sub_items').delete().eq('parent_item_id', body.id)
      for (let i = 0; i < body.subItems.length; i++) {
        const sub = body.subItems[i]
        if (sub.id) {
          await supabase.from('sub_items').insert({
            parent_item_id: data!.id,
            child_item_id: sub.id,
            restaurant_id: restaurantId,
            sort_order: i,
          })
        }
      }
    }

    await bumpMenuVersion(restaurantId)
    return data
  })

  fastify.post('/item/with-images', {
    preHandler: requireAdmin,
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req: any, reply) => {
    const restaurantId = req.admin!.restaurant_id
    const parts = req.parts()

    let itemData: any = null
    const imageUrls: string[] = []
    const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

    for await (const part of parts) {
      if (part.type === 'field' && part.fieldname === 'itemData') {
        itemData = JSON.parse(part.value as string)
      } else if (part.type === 'file' && part.fieldname === 'uploadedImages') {
        const mime = part.mimetype
        if (!ALLOWED_MIME.includes(mime)) {
          return reply.status(400).send({ error: 'Unsupported image type. Only PNG, JPG, JPEG, WebP allowed.' })
        }
        const chunks: Buffer[] = []
        for await (const chunk of part.file) chunks.push(chunk)
        const buffer = Buffer.concat(chunks)
        if (buffer.length > 5 * 1024 * 1024) {
          return reply.status(400).send({ error: 'Image must be smaller than 5MB.' })
        }
        const url = await uploadItemImage(restaurantId, buffer, mime)
        imageUrls.push(url)
      }
    }

    if (!itemData) return reply.status(400).send({ error: 'itemData field is required' })

    const body = itemBody.parse({ ...itemData, restaurantId: itemData.restaurantId ?? restaurantId })
    if (body.restaurantId !== restaurantId) throw new ForbiddenError()
    if (body.id) await assertItemOwner(restaurantId, body.id)

    // Merge new images with existing
    const existingImages: string[] = body.id
      ? ((await supabase.from('items').select('images').eq('id', body.id).single()).data?.images ?? [])
      : []
    const allImages = [...existingImages, ...imageUrls]

    const payload = {
      restaurant_id: restaurantId,
      category_id: body.categoryId,
      item_name: body.item_name,
      item_name_arabic: body.item_name_arabic,
      description: body.description,
      description_arabic: body.description_arabic,
      price: body.price,
      image: allImages[0] ?? null,
      images: allImages,
      is_visible: body.visible ?? true,
      is_combo: body.is_combo ?? false,
      updated_at: new Date().toISOString(),
    }

    let data, error
    if (body.id) {
      ({ data, error } = await supabase.from('items').update(payload).eq('id', body.id).select().single())
    } else {
      ({ data, error } = await supabase.from('items').insert(payload).select().single())
    }
    if (error) throw new Error(error.message)

    await bumpMenuVersion(restaurantId)
    return data
  })

  fastify.get('/item/time-availability', { preHandler: requireAdmin }, async (req: any) => {
    const restaurantId = req.admin!.restaurant_id
    const { data } = await supabase
      .from('item_time_availability')
      .select('*')
      .eq('restaurant_id', restaurantId)
    return data || []
  })

  fastify.post('/item/time-availability', { preHandler: requireAdmin }, async (req: any) => {
    const body = z.object({
      itemId: z.number(),
      restaurantId: z.number().optional(),
      startTime: z.string(),
      endTime: z.string(),
      enabled: z.boolean(),
    }).parse(req.body)
    const restaurantId = req.admin!.restaurant_id
    await assertItemOwner(restaurantId, body.itemId)

    const { data, error } = await supabase.from('item_time_availability').upsert({
      item_id: body.itemId,
      restaurant_id: restaurantId,
      start_time: body.startTime,
      end_time: body.endTime,
      enabled: body.enabled,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'item_id' }).select().single()

    if (error) throw new Error(error.message)
    return data
  })

  fastify.post('/item/top_products', { preHandler: requireAdmin }, async (req: any) => {
    const body = z.object({
      restaurantId: z.number().optional(),
      franchiseIds: z.array(z.number()).optional(),
      timeInterval: z.string().optional(),
      startDate: z.string().optional().nullable(),
      endDate: z.string().optional().nullable(),
      limit: z.number().optional().default(10),
    }).parse(req.body)
    const restaurantId = req.admin!.restaurant_id

    const { resolveDateRange } = await import('../../lib/dates')
    const range = resolveDateRange(body.timeInterval || 'THIS_MONTH', body.startDate ?? undefined, body.endDate ?? undefined)

    let query = supabase
      .from('receipt_items')
      .select('item_id, item_name, quantity, receipts!inner(restaurant_id, created_at, receipt_state)')
      .eq('receipts.restaurant_id', restaurantId)
      .eq('receipts.receipt_state', 'DELIVERED')
      .gte('receipts.created_at', range.startDate)
      .lte('receipts.created_at', range.endDate)

    if (body.franchiseIds?.length) {
      query = query.in('receipts.franchise_id', body.franchiseIds)
    }

    const { data } = await query

    // Aggregate client-side
    const totals = new Map<number, { item_id: number; item_name: string; units_sold: number }>()
    for (const row of data || []) {
      const entry = totals.get(row.item_id) || { item_id: row.item_id, item_name: row.item_name, units_sold: 0 }
      entry.units_sold += row.quantity
      totals.set(row.item_id, entry)
    }
    const sorted = [...totals.values()].sort((a, b) => b.units_sold - a.units_sold).slice(0, body.limit)
    return sorted
  })

  fastify.get('/item/subitem-offers', { preHandler: requireAdmin }, async (req: any) => {
    const restaurantId = req.admin!.restaurant_id
    const subItemIds = (req.query?.subItemIds as string)?.split(',').map(Number).filter(Boolean)
    if (!subItemIds?.length) return []

    const { data } = await supabase
      .from('franchise_package_offers')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .overlaps('sub_item_ids', subItemIds)

    return data || []
  })

  // ── ADDONS ─────────────────────────────────────────────────────────────────

  fastify.get('/addon/list', { preHandler: requireAdmin }, async (req: any) => {
    const restaurantId = req.admin!.restaurant_id
    const { data } = await supabase
      .from('addon_groups')
      .select('*, addon_values(*)')
      .eq('restaurant_id', restaurantId)
      .is('deleted_at', null)
      .order('id')
    return { allAddons: data || [] }
  })

  fastify.post('/addon/add-edit', { preHandler: requireAdmin }, async (req: any) => {
    const body = addonGroupBody.parse(req.body)
    const restaurantId = req.admin!.restaurant_id
    if (body.restaurantId !== restaurantId) throw new ForbiddenError()

    const groupPayload = {
      restaurant_id: restaurantId,
      name: body.name,
      name_arabic: body.name_arabic,
      required: body.required ?? false,
      min_select: body.min ?? 0,
      max_select: body.max ?? 1,
      updated_at: new Date().toISOString(),
    }

    let groupId: number
    if (body.id) {
      const { data } = await supabase.from('addon_groups').update(groupPayload)
        .eq('id', body.id).eq('restaurant_id', restaurantId).select('id').single()
      groupId = data!.id
    } else {
      const { data } = await supabase.from('addon_groups').insert(groupPayload).select('id').single()
      groupId = data!.id
    }

    // Sync values
    if (body.addonValues) {
      for (const val of body.addonValues) {
        if (val.id) {
          await supabase.from('addon_values').update({
            name: val.name, name_arabic: val.name_arabic, price: val.price,
          }).eq('id', val.id).eq('addon_group_id', groupId)
        } else {
          await supabase.from('addon_values').insert({
            addon_group_id: groupId,
            restaurant_id: restaurantId,
            name: val.name,
            name_arabic: val.name_arabic,
            price: val.price,
          })
        }
      }
    }

    await bumpMenuVersion(restaurantId)

    const { data: group } = await supabase.from('addon_groups').select('*, addon_values(*)').eq('id', groupId).single()
    return group
  })

  fastify.post('/addon/delete', { preHandler: requireAdmin }, async (req: any) => {
    const body = z.object({ id: z.number(), restaurantId: z.number() }).parse(req.body)
    const restaurantId = req.admin!.restaurant_id
    if (body.restaurantId !== restaurantId) throw new ForbiddenError()

    await supabase.from('addon_groups').update({ deleted_at: new Date().toISOString() })
      .eq('id', body.id).eq('restaurant_id', restaurantId)

    await bumpMenuVersion(restaurantId)
    return { success: true }
  })
}
