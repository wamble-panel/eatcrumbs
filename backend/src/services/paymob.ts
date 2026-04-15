import axios from 'axios'
import crypto from 'crypto'
import { env } from '../config/env'

const BASE = 'https://accept.paymob.com/api'

interface CreateOrderParams {
  amountCents: number
  currency: string
  merchantOrderId: string
  items: { name: string; amount_cents: number; description: string; quantity: number }[]
}

interface CreatePaymentKeyParams {
  authToken: string
  amountCents: number
  orderId: number
  currency: string
  integrationId: number
  billingData: {
    first_name: string
    last_name: string
    email: string
    phone_number: string
  }
  cardToken?: string
}

export async function getAuthToken(): Promise<string> {
  const { data } = await axios.post(`${BASE}/auth/tokens`, {
    api_key: env.PAYMOB_API_KEY,
  })
  return data.token
}

export async function createOrder(authToken: string, params: CreateOrderParams): Promise<number> {
  const { data } = await axios.post(
    `${BASE}/ecommerce/orders`,
    {
      auth_token: authToken,
      delivery_needed: false,
      amount_cents: params.amountCents,
      currency: params.currency,
      merchant_order_id: params.merchantOrderId,
      items: params.items,
    },
  )
  return data.id
}

export async function createPaymentKey(params: CreatePaymentKeyParams): Promise<string> {
  const { data } = await axios.post(`${BASE}/acceptance/payment_keys`, {
    auth_token: params.authToken,
    amount_cents: params.amountCents,
    expiration: 3600,
    order_id: params.orderId,
    currency: params.currency,
    integration_id: Number(params.integrationId),
    billing_data: params.billingData,
    ...(params.cardToken ? { token: params.cardToken } : {}),
  })
  return data.token
}

export function verifyHmac(body: Record<string, any>, receivedHmac: string): boolean {
  if (!env.PAYMOB_HMAC_SECRET) {
    // Fail closed: never accept a webhook we cannot verify.
    // Set PAYMOB_HMAC_SECRET in your environment to enable Paymob callbacks.
    return false
  }

  // Paymob HMAC: concatenate specific fields in alphabetical order
  const fields = [
    'amount_cents', 'created_at', 'currency', 'error_occured', 'has_parent_transaction',
    'id', 'integration_id', 'is_3d_secure', 'is_auth', 'is_capture', 'is_refunded',
    'is_standalone_payment', 'is_voided', 'order', 'owner', 'pending',
    'source_data.pan', 'source_data.sub_type', 'source_data.type', 'success',
  ]

  const obj = body.obj || body
  const str = fields
    .map((f) => {
      const parts = f.split('.')
      let val: any = obj
      for (const p of parts) val = val?.[p]
      return String(val ?? '')
    })
    .join('')

  const hash = crypto.createHmac('sha512', env.PAYMOB_HMAC_SECRET).update(str).digest('hex')
  return hash === receivedHmac
}

/** High-level: initiate a full Paymob payment and return the iframe URL */
export async function initiatePayment(opts: {
  amountCents: number
  currency: string
  receiptId: string
  integrationId: number
  billingData: CreatePaymentKeyParams['billingData']
  cardToken?: string
}): Promise<{ paymentKey: string; paymobOrderId: number }> {
  const authToken = await getAuthToken()
  const paymobOrderId = await createOrder(authToken, {
    amountCents: opts.amountCents,
    currency: opts.currency,
    merchantOrderId: opts.receiptId,
    items: [],
  })
  const paymentKey = await createPaymentKey({
    authToken,
    amountCents: opts.amountCents,
    orderId: paymobOrderId,
    currency: opts.currency,
    integrationId: opts.integrationId,
    billingData: opts.billingData,
    cardToken: opts.cardToken,
  })
  return { paymentKey, paymobOrderId }
}
