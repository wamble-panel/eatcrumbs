import axios from 'axios'
import { env } from '../config/env'

const BASE = 'https://graph.facebook.com/v18.0'

interface SendOtpParams {
  to: string      // E.164 format, e.g. +201001234567
  code: string
  lang?: string
}

interface SendOrderParams {
  to: string
  orderId: string
  restaurantName: string
  items: string
  total: string
  currency: string
  templateName: string
}

async function send(to: string, template: string, components: any[]) {
  if (!env.WHATSAPP_API_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    // WhatsApp not configured — skip silently (no PII in logs)
    return
  }
  await axios.post(
    `${BASE}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: template,
        language: { code: 'en' },
        components,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    },
  )
}

export async function sendOtp({ to, code }: SendOtpParams) {
  await send(to, 'otp_verification', [
    {
      type: 'body',
      parameters: [{ type: 'text', text: code }],
    },
  ])
}

export async function notifyOrderPlaced({ to, orderId, restaurantName, items, total, currency }: SendOrderParams) {
  await send(to, 'order_placed', [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: orderId.slice(0, 8).toUpperCase() },
        { type: 'text', text: restaurantName },
        { type: 'text', text: items },
        { type: 'text', text: `${total} ${currency}` },
      ],
    },
  ])
}

export async function notifyOrderAccepted({ to, orderId, restaurantName }: Pick<SendOrderParams, 'to' | 'orderId' | 'restaurantName'>) {
  await send(to, 'order_accepted', [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: orderId.slice(0, 8).toUpperCase() },
        { type: 'text', text: restaurantName },
      ],
    },
  ])
}

export async function notifyOrderReady({ to, orderId, restaurantName }: Pick<SendOrderParams, 'to' | 'orderId' | 'restaurantName'>) {
  await send(to, 'order_ready', [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: orderId.slice(0, 8).toUpperCase() },
        { type: 'text', text: restaurantName },
      ],
    },
  ])
}

export async function notifyOrderOutForDelivery({ to, orderId }: Pick<SendOrderParams, 'to' | 'orderId'>) {
  await send(to, 'order_out_for_delivery', [
    {
      type: 'body',
      parameters: [{ type: 'text', text: orderId.slice(0, 8).toUpperCase() }],
    },
  ])
}
