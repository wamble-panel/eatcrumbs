import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabase } from '../../config/supabase'
import { requireAdmin } from '../../middleware/auth'
import { env } from '../../config/env'

const FOODICS_BASE = 'https://api.foodics.com/v5'

async function getFoodicsToken(restaurantId: number): Promise<string | null> {
  const { data } = await supabase
    .from('foodics_credentials')
    .select('access_token, expires_at')
    .eq('restaurant_id', restaurantId)
    .single()

  if (!data) return null
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null
  return data.access_token
}

async function foodicsFetch(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<any> {
  const res = await fetch(`${FOODICS_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string> ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Foodics API ${res.status}: ${body}`)
  }
  return res.json()
}

export default async function adminFoodicsRoutes(fastify: FastifyInstance) {
  // GET /foodics/status — check if connected
  fastify.get('/foodics/status', { preHandler: requireAdmin }, async (request) => {
    const restaurantId = request.admin!.restaurant_id
    const { data } = await supabase
      .from('foodics_credentials')
      .select('id, expires_at, updated_at')
      .eq('restaurant_id', restaurantId)
      .single()

    return {
      connected: !!data,
      expiresAt: data?.expires_at ?? null,
      updatedAt: data?.updated_at ?? null,
    }
  })

  // GET /foodics/auth-url — redirect URL for OAuth
  fastify.get('/foodics/auth-url', { preHandler: requireAdmin }, async (request) => {
    const state = Buffer.from(String(request.admin!.restaurant_id)).toString('base64')
    const redirectUri = `${env.BACKEND_URL ?? ''}/admin/v2/foodics/callback`
    const url = `https://console.foodics.com/authorize?client_id=${env.FOODICS_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${state}`
    return { url }
  })

  // GET /foodics/callback — OAuth callback
  fastify.get('/foodics/callback', async (request, reply) => {
    const q = z.object({
      code: z.string(),
      state: z.string(),
    }).parse(request.query)

    const restaurantId = Number(Buffer.from(q.state, 'base64').toString())
    if (!restaurantId || isNaN(restaurantId)) {
      return reply.status(400).send({ error: 'Invalid state' })
    }

    const redirectUri = `${env.BACKEND_URL ?? ''}/admin/v2/foodics/callback`
    const tokenRes = await fetch('https://api.foodics.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: env.FOODICS_CLIENT_ID,
        client_secret: env.FOODICS_CLIENT_SECRET,
        redirect_uri: redirectUri,
        code: q.code,
      }),
    })

    if (!tokenRes.ok) {
      return reply.status(400).send({ error: 'Failed to exchange code for token' })
    }

    const tokenData = await tokenRes.json()
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null

    // Upsert credentials
    const { data: existing } = await supabase
      .from('foodics_credentials')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .single()

    if (existing) {
      await supabase.from('foodics_credentials').update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token ?? null,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }).eq('restaurant_id', restaurantId)
    } else {
      await supabase.from('foodics_credentials').insert({
        restaurant_id: restaurantId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token ?? null,
        expires_at: expiresAt,
      })
    }

    // Mark restaurant as Foodics restaurant
    await supabase.from('restaurants').update({ is_foodics: true }).eq('id', restaurantId)

    const adminFrontend = env.ADMIN_FRONTEND_URL ?? 'https://admin.prepit.app'
    return reply.redirect(`${adminFrontend}/foodics?connected=true`)
  })

  // POST /foodics/disconnect
  fastify.post('/foodics/disconnect', { preHandler: requireAdmin }, async (request) => {
    const restaurantId = request.admin!.restaurant_id
    await supabase.from('foodics_credentials').delete().eq('restaurant_id', restaurantId)
    await supabase.from('restaurants').update({ is_foodics: false }).eq('id', restaurantId)
    return { success: true }
  })

  // POST /foodics/sync — pull Foodics menu into our DB
  fastify.post('/foodics/sync', { preHandler: requireAdmin }, async (request, reply) => {
    const restaurantId = request.admin!.restaurant_id
    const token = await getFoodicsToken(restaurantId)
    if (!token) return reply.status(400).send({ error: 'Not connected to Foodics' })

    // Insert sync log
    const { data: syncLog } = await supabase
      .from('foodics_syncs')
      .insert({
        restaurant_id: restaurantId,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    const syncId = syncLog?.id

    try {
      // Fetch Foodics products
      const productsData = await foodicsFetch('/products?limit=500', token)
      const products = productsData.data ?? []

      // Fetch/upsert categories from Foodics
      const categoriesData = await foodicsFetch('/categories?limit=200', token)
      const foodicsCategories = categoriesData.data ?? []

      let itemsSynced = 0

      for (const fc of foodicsCategories) {
        // Upsert category
        const { data: cat } = await supabase
          .from('categories')
          .upsert({
            restaurant_id: restaurantId,
            name: fc.name,
            name_arabic: fc.name_ar ?? null,
            is_active: fc.is_active ?? true,
          }, { onConflict: 'restaurant_id,name' })
          .select('id')
          .single()

        if (!cat) continue

        // Items for this category
        const catProducts = products.filter((p: any) => p.category_id === fc.id)
        for (const p of catProducts) {
          await supabase
            .from('items')
            .upsert({
              restaurant_id: restaurantId,
              category_id: cat.id,
              name: p.name,
              name_arabic: p.name_ar ?? null,
              description: p.description ?? null,
              price: p.price ?? 0,
              is_active: p.is_active ?? true,
            }, { onConflict: 'restaurant_id,name,category_id' })
          itemsSynced++
        }
      }

      // Bump menu version
      await supabase.rpc('bump_menu_version', { p_restaurant_id: restaurantId })

      if (syncId) {
        await supabase.from('foodics_syncs').update({
          status: 'success',
          finished_at: new Date().toISOString(),
          items_synced: itemsSynced,
        }).eq('id', syncId)
      }

      return { success: true, itemsSynced }
    } catch (err: any) {
      if (syncId) {
        await supabase.from('foodics_syncs').update({
          status: 'error',
          finished_at: new Date().toISOString(),
          error: err.message,
        }).eq('id', syncId)
      }
      return reply.status(500).send({ error: err.message })
    }
  })

  // GET /foodics/sync-history
  fastify.get('/foodics/sync-history', { preHandler: requireAdmin }, async (request) => {
    const restaurantId = request.admin!.restaurant_id
    const { data } = await supabase
      .from('foodics_syncs')
      .select('id, status, started_at, finished_at, items_synced, error, created_at')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(20)

    return { history: data ?? [] }
  })
}
