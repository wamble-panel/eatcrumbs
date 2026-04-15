import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabase } from '../../config/supabase'
import { signCustomerToken } from '../../lib/jwt'
import { generateOtp, storeOtp, verifyOtp, otpKey } from '../../lib/otp'
import { sendOtp as sendWhatsappOtp } from '../../services/whatsapp'
import { NotFoundError, AppError, ForbiddenError } from '../../lib/errors'
import { requireCustomer } from '../../middleware/auth'

/**
 * Compiled storefront only knows `franchiseId`; it never sends `restaurantId`
 * in /auth/* or user/* bodies. Resolve it from either the tenant middleware
 * (subdomain/custom-domain) or by looking the franchise up.
 */
async function resolveRestaurantId(
  req: any,
  franchiseId?: number,
): Promise<number | null> {
  if (req.restaurantId) return req.restaurantId
  if (!franchiseId) return null
  const { data } = await supabase
    .from('franchises')
    .select('restaurant_id')
    .eq('id', franchiseId)
    .single()
  return data?.restaurant_id ?? null
}

/**
 * If the subdomain resolved a tenant (`req.restaurantId`), the body's
 * `restaurantId` must match. Prevents a page on brand A from signing up
 * / logging in customers into brand B by forging the body.
 */
function assertBodyMatchesTenant(req: any, bodyRestaurantId: number) {
  if (req.restaurantId && req.restaurantId !== bodyRestaurantId) {
    throw new ForbiddenError('Restaurant does not match storefront tenant')
  }
}
import { ORGANICATION_CUSTOMER_VERIFIED } from '../../types'

const sendOtpBody = z.object({
  phoneNumber: z.string().min(7).max(20),
  restaurantId: z.number().int().positive(),
})

const verifyOtpBody = z.object({
  phoneNumber: z.string().min(7).max(20),
  restaurantId: z.number().int().positive(),
  otp: z.string().length(6).regex(/^\d{6}$/),
  personName: z.string().max(100).optional(),
  referralCode: z.string().max(20).optional(),
})

export default async function customerAuthRoutes(fastify: FastifyInstance) {
  // POST /customer/send-otp
  fastify.post(
    '/customer/send-otp',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = sendOtpBody.parse(request.body)
      assertBodyMatchesTenant(request, body.restaurantId)

      // Verify restaurant exists
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('id')
        .eq('id', body.restaurantId)
        .single()

      if (!restaurant) throw new NotFoundError('Restaurant not found')

      const code = generateOtp()
      storeOtp(otpKey(body.phoneNumber, body.restaurantId), code)

      await sendWhatsappOtp({ to: body.phoneNumber, code }).catch((err) => {
        // Log but don't fail — customer can still use code if WhatsApp is down
        fastify.log.warn({ err }, 'WhatsApp OTP send failed')
      })

      return { success: true }
    },
  )

  // POST /customer/verify-otp
  fastify.post('/customer/verify-otp', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = verifyOtpBody.parse(request.body)
    assertBodyMatchesTenant(request, body.restaurantId)

    const valid = verifyOtp(otpKey(body.phoneNumber, body.restaurantId), body.otp)
    if (!valid) throw new AppError(400, 'Invalid or expired OTP')

    // Find or create customer
    let { data: customer } = await supabase
      .from('customers')
      .select('id, restaurant_id, phone_number, person_name, is_visitor, referral_code, points')
      .eq('restaurant_id', body.restaurantId)
      .eq('phone_number', body.phoneNumber)
      .single()

    if (!customer) {
      // Generate a unique referral code
      const referralCode = `${body.phoneNumber.slice(-4)}${Math.random().toString(36).substring(2, 6).toUpperCase()}`

      // Handle referral if provided
      let referredBy: string | null = null
      if (body.referralCode) {
        const { data: referrer } = await supabase
          .from('customers')
          .select('id')
          .eq('restaurant_id', body.restaurantId)
          .eq('referral_code', body.referralCode.toUpperCase())
          .single()
        if (referrer) referredBy = referrer.id
      }

      const { data: newCustomer, error } = await supabase
        .from('customers')
        .insert({
          restaurant_id: body.restaurantId,
          phone_number: body.phoneNumber,
          person_name: body.personName ?? null,
          is_visitor: false,
          referral_code: referralCode,
          referred_by: referredBy,
        })
        .select('id, restaurant_id, phone_number, person_name, is_visitor, referral_code, points')
        .single()

      if (error || !newCustomer) throw new AppError(500, 'Failed to create customer')
      customer = newCustomer

      // Award referral points if applicable
      if (referredBy) {
        try {
          await supabase.from('referrals').insert({
            referrer_id: referredBy,
            referred_id: customer.id,
            restaurant_id: body.restaurantId,
          })
        } catch {
          // ignore duplicate errors
        }
      }
    } else if (body.personName && !customer.person_name) {
      await supabase
        .from('customers')
        .update({ person_name: body.personName, updated_at: new Date().toISOString() })
        .eq('id', customer.id)
      customer.person_name = body.personName
    }

    const token = signCustomerToken({
      customer_id: customer.id,
      restaurant_id: body.restaurantId,
      person_name: customer.person_name ?? '',
      phone_number: body.phoneNumber,
      is_visitor: false,
    })

    reply.setCookie('TOKEN', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60,
    })

    return {
      token,
      customer: {
        id: customer.id,
        phoneNumber: customer.phone_number,
        personName: customer.person_name,
        points: customer.points,
        referralCode: customer.referral_code,
        organizationStatus: ORGANICATION_CUSTOMER_VERIFIED,
      },
    }
  })

  // POST /customer/visitor-login  (guest checkout)
  fastify.post('/customer/visitor-login', async (request, reply) => {
    const body = z.object({
      restaurantId: z.number().int().positive(),
    }).parse(request.body)
    assertBodyMatchesTenant(request, body.restaurantId)

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id')
      .eq('id', body.restaurantId)
      .single()

    if (!restaurant) throw new NotFoundError('Restaurant not found')

    // Create ephemeral visitor customer
    const visitorPhone = `visitor_${Date.now()}`
    const { data: visitor, error } = await supabase
      .from('customers')
      .insert({
        restaurant_id: body.restaurantId,
        phone_number: visitorPhone,
        is_visitor: true,
      })
      .select('id')
      .single()

    if (error || !visitor) throw new AppError(500, 'Failed to create visitor session')

    const token = signCustomerToken({
      customer_id: visitor.id,
      restaurant_id: body.restaurantId,
      person_name: '',
      phone_number: '',
      is_visitor: true,
    })

    reply.setCookie('TOKEN', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 24 * 60 * 60,  // 1 day for visitors
    })

    return { token, visitor: { id: visitor.id } }
  })

  // POST /customer/logout
  fastify.post('/customer/logout', { preHandler: requireCustomer }, async (_request, reply) => {
    reply.clearCookie('TOKEN', { path: '/' })
    return { success: true }
  })

  // GET /customer/me
  fastify.get('/customer/me', { preHandler: requireCustomer }, async (request) => {
    const customerId = request.customer!.customer_id
    const restaurantId = request.customer!.restaurant_id

    const { data: customer } = await supabase
      .from('customers')
      .select('id, phone_number, person_name, email, points, referral_code, created_at')
      .eq('id', customerId)
      .eq('restaurant_id', restaurantId)
      .single()

    return { customer }
  })

  // POST /customer/update-profile
  fastify.post('/customer/update-profile', { preHandler: requireCustomer }, async (request) => {
    const customerId = request.customer!.customer_id
    const restaurantId = request.customer!.restaurant_id
    const body = z.object({
      personName: z.string().min(1).optional(),
      email: z.string().email().optional(),
    }).parse(request.body)

    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    if (body.personName) updates.person_name = body.personName
    if (body.email) updates.email = body.email

    await supabase
      .from('customers')
      .update(updates)
      .eq('id', customerId)
      .eq('restaurant_id', restaurantId)

    return { success: true }
  })

  // ── Compiled-storefront aliases ──────────────────────────────────────────────
  // The customer bundle calls `/auth/otp`, `/auth/check-otp`, `user/create-visitor`,
  // `user/delete`. Paths, body shapes and sometimes methods differ from the
  // canonical `/customer/*` routes. These wrappers translate the contract.

  // POST /auth/otp
  //
  // The storefront uses ONE endpoint for both "send OTP" and "verify OTP":
  //   • if `code` is absent → send a new OTP
  //   • if `code` is present → verify the code (and create/login the customer)
  //
  // Body (superset of fields, most unused):
  //   { phoneNumber, countryCode?, name?, code?, franchiseId, login?,
  //     isPartnerAppUser?, isMobileAppUser?, isWebSelfServiceUser?, referralCode? }
  fastify.post(
    '/auth/otp',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = z.object({
        phoneNumber: z.string().min(7).max(20),
        countryCode: z.string().optional(),
        name: z.string().optional(),
        code: z.string().length(6).optional(),
        franchiseId: z.number().int().positive().optional(),
        referralCode: z.string().optional(),
      }).passthrough().parse(request.body)

      // Normalise: frontend sometimes sends "+20" separate from number
      const phone = body.countryCode
        ? `${body.countryCode.replace(/^\+?/, '+')}${body.phoneNumber.replace(/^\+?/, '')}`
        : body.phoneNumber

      const restaurantId = await resolveRestaurantId(request, body.franchiseId)
      if (!restaurantId) throw new NotFoundError('Restaurant not found')

      // ── Verification branch ────────────────────────────────────────────────
      if (body.code) {
        const valid = verifyOtp(otpKey(phone, restaurantId), body.code)
        if (!valid) throw new AppError(400, 'Invalid or expired OTP')

        let { data: customer } = await supabase
          .from('customers')
          .select('id, restaurant_id, phone_number, person_name, is_visitor, referral_code, points')
          .eq('restaurant_id', restaurantId)
          .eq('phone_number', phone)
          .single()

        if (!customer) {
          const referralCode = `${phone.slice(-4)}${Math.random().toString(36).substring(2, 6).toUpperCase()}`

          let referredBy: string | null = null
          if (body.referralCode) {
            const { data: referrer } = await supabase
              .from('customers')
              .select('id')
              .eq('restaurant_id', restaurantId)
              .eq('referral_code', body.referralCode.toUpperCase())
              .single()
            if (referrer) referredBy = referrer.id
          }

          const { data: newCustomer, error } = await supabase
            .from('customers')
            .insert({
              restaurant_id: restaurantId,
              phone_number: phone,
              person_name: body.name ?? null,
              is_visitor: false,
              referral_code: referralCode,
              referred_by: referredBy,
            })
            .select('id, restaurant_id, phone_number, person_name, is_visitor, referral_code, points')
            .single()

          if (error || !newCustomer) throw new AppError(500, 'Failed to create customer')
          customer = newCustomer

          if (referredBy) {
            try {
              await supabase.from('referrals').insert({
                referrer_id: referredBy,
                referred_id: customer.id,
                restaurant_id: restaurantId,
              })
            } catch {
              // ignore duplicate errors
            }
          }
        } else if (body.name && !customer.person_name) {
          await supabase
            .from('customers')
            .update({ person_name: body.name, updated_at: new Date().toISOString() })
            .eq('id', customer.id)
          customer.person_name = body.name
        }

        const token = signCustomerToken({
          customer_id: customer.id,
          restaurant_id: restaurantId,
          person_name: customer.person_name ?? '',
          phone_number: phone,
          is_visitor: false,
        })

        reply.setCookie('TOKEN', token, {
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'none',
          maxAge: 30 * 24 * 60 * 60,
        })

        return {
          token,
          customer: {
            id: customer.id,
            phoneNumber: customer.phone_number,
            personName: customer.person_name,
            points: customer.points,
            referralCode: customer.referral_code,
            organizationStatus: ORGANICATION_CUSTOMER_VERIFIED,
          },
        }
      }

      // ── Send branch ────────────────────────────────────────────────────────
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('id')
        .eq('id', restaurantId)
        .single()
      if (!restaurant) throw new NotFoundError('Restaurant not found')

      const code = generateOtp()
      storeOtp(otpKey(phone, restaurantId), code)

      await sendWhatsappOtp({ to: phone, code }).catch((err) => {
        fastify.log.warn({ err }, 'WhatsApp OTP send failed')
      })

      return { success: true }
    },
  )

  // POST /auth/check-otp
  //
  // The storefront sends `{phoneNumber, name, code, isPartnerAppUser,
  // isMobileAppUser, isWebSelfServiceUser, email?, organization?, title?}`
  // and expects the same verify-and-login response as `/customer/verify-otp`.
  fastify.post('/auth/check-otp', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = z.object({
      phoneNumber: z.string().min(7).max(20),
      countryCode: z.string().optional(),
      name: z.string().optional(),
      code: z.string().length(6),
      email: z.string().email().optional(),
      franchiseId: z.number().int().positive().optional(),
      referralCode: z.string().optional(),
    }).passthrough().parse(request.body)

    const phone = body.countryCode
      ? `${body.countryCode.replace(/^\+?/, '+')}${body.phoneNumber.replace(/^\+?/, '')}`
      : body.phoneNumber

    const restaurantId = await resolveRestaurantId(request, body.franchiseId)
    if (!restaurantId) throw new NotFoundError('Restaurant not found')

    const valid = verifyOtp(otpKey(phone, restaurantId), body.code)
    if (!valid) throw new AppError(400, 'Invalid or expired OTP')

    let { data: customer } = await supabase
      .from('customers')
      .select('id, restaurant_id, phone_number, person_name, email, is_visitor, referral_code, points')
      .eq('restaurant_id', restaurantId)
      .eq('phone_number', phone)
      .single()

    if (!customer) {
      const referralCode = `${phone.slice(-4)}${Math.random().toString(36).substring(2, 6).toUpperCase()}`

      let referredBy: string | null = null
      if (body.referralCode) {
        const { data: referrer } = await supabase
          .from('customers')
          .select('id')
          .eq('restaurant_id', restaurantId)
          .eq('referral_code', body.referralCode.toUpperCase())
          .single()
        if (referrer) referredBy = referrer.id
      }

      const { data: newCustomer, error } = await supabase
        .from('customers')
        .insert({
          restaurant_id: restaurantId,
          phone_number: phone,
          person_name: body.name ?? null,
          email: body.email ?? null,
          is_visitor: false,
          referral_code: referralCode,
          referred_by: referredBy,
        })
        .select('id, restaurant_id, phone_number, person_name, email, is_visitor, referral_code, points')
        .single()

      if (error || !newCustomer) throw new AppError(500, 'Failed to create customer')
      customer = newCustomer
    } else {
      const updates: Record<string, any> = {}
      if (body.name && !customer.person_name) updates.person_name = body.name
      if (body.email && !customer.email) updates.email = body.email
      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString()
        await supabase.from('customers').update(updates).eq('id', customer.id)
        Object.assign(customer, updates)
      }
    }

    const token = signCustomerToken({
      customer_id: customer.id,
      restaurant_id: restaurantId,
      person_name: customer.person_name ?? '',
      phone_number: phone,
      is_visitor: false,
    })

    reply.setCookie('TOKEN', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60,
    })

    return {
      token,
      customer: {
        id: customer.id,
        phoneNumber: customer.phone_number,
        personName: customer.person_name,
        email: customer.email ?? null,
        points: customer.points,
        referralCode: customer.referral_code,
        organizationStatus: ORGANICATION_CUSTOMER_VERIFIED,
      },
    }
  })

  // POST /user/create-visitor
  //
  // Frontend sends app-type flags; restaurantId must come from the tenant
  // middleware (subdomain or custom domain).
  fastify.post('/user/create-visitor', async (request, reply) => {
    const restaurantId = request.restaurantId
    if (!restaurantId) throw new NotFoundError('Restaurant not found')

    const visitorPhone = `visitor_${Date.now()}`
    const { data: visitor, error } = await supabase
      .from('customers')
      .insert({
        restaurant_id: restaurantId,
        phone_number: visitorPhone,
        is_visitor: true,
      })
      .select('id')
      .single()

    if (error || !visitor) throw new AppError(500, 'Failed to create visitor session')

    const token = signCustomerToken({
      customer_id: visitor.id,
      restaurant_id: restaurantId,
      person_name: '',
      phone_number: '',
      is_visitor: true,
    })

    reply.setCookie('TOKEN', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 24 * 60 * 60,
    })

    return { token, visitor: { id: visitor.id } }
  })

  // POST /user/delete — storefront uses POST where canonical route is DELETE
  fastify.post('/user/delete', { preHandler: requireCustomer }, async (request, reply) => {
    const customerId = request.customer!.customer_id
    const restaurantId = request.customer!.restaurant_id

    await supabase
      .from('customers')
      .update({
        phone_number: `deleted_${Date.now()}`,
        person_name: null,
        email: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customerId)
      .eq('restaurant_id', restaurantId)

    reply.clearCookie('TOKEN', { path: '/' })
    return { success: true }
  })
}
