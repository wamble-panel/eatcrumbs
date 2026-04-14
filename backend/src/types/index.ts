import type { FastifyRequest } from 'fastify'

export interface AdminJwtPayload {
  admin_id: string
  restaurant_id: number
  role: 'owner' | 'manager' | 'staff'
  email: string
}

export interface CustomerJwtPayload {
  customer_id: string
  restaurant_id: number
  person_name?: string
  phone_number?: string
  is_visitor?: boolean
}

export type JwtPayload = AdminJwtPayload | CustomerJwtPayload

// Augment Fastify request
declare module 'fastify' {
  interface FastifyRequest {
    restaurantId: number
    admin?: AdminJwtPayload
    customer?: CustomerJwtPayload
  }
}

// Enums mirroring the frontend
export const ReceiptState = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  READY: 'READY',
  ON_WAY_TO_PICKUP: 'ON_WAY_TO_PICKUP',
  ON_WAY_TO_DELIVERY: 'ON_WAY_TO_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const

export const OrderType = {
  DELIVERY: 'DELIVERY',
  TAKE_OUT: 'TAKE_OUT',
  DINE_IN: 'DINE_IN',
  DELIVERYV2: 'DELIVERYV2',
} as const

export const PaymentMethod = {
  CASH: 'cash',
  ONLINE_CARD: 'online_card',
  ONLINE: 'online_card',     // alias used in older frontend code
  CARD_ON_DELIVERY: 'card_on_delivery',
  POS: 'pos',
  NONE: 'none',
} as const

export const PaymentStatus = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
} as const

export const OfferType = {
  FIXED_AMOUNT: 'FIXED_AMOUNT',
  PERCENTAGE_AMOUNT: 'PERCENTAGE_AMOUNT',
  FREE_ITEM: 'FREE_ITEM',
  DISCOUNT_ITEM: 'DISCOUNT_ITEM',
} as const

export const TimeInterval = {
  TODAY: 'TODAY',
  YESTERDAY: 'YESTERDAY',
  THIS_WEEK: 'THIS_WEEK',
  LAST_WEEK: 'LAST_WEEK',
  THIS_MONTH: 'THIS_MONTH',
  LAST_MONTH: 'LAST_MONTH',
  LAST_YEAR: 'LAST_YEAR',
  THIS_YEAR: 'THIS_YEAR',
  PREVIOUS_30_DAYS: 'PREVIOUS_30_DAYS',
  SPECIFIC_RANGE: 'SPECIFIC_RANGE',
  ALL: 'ALL',
} as const

export const ReportType = {
  ORDER_DATA: 'ORDER_DATA',
  MENU_DATA: 'MENU_DATA',
  FEEDBACK_DATA: 'FEEDBACK_DATA',
  CUSTOMER_DATA: 'CUSTOMER_DATA',
  LOYALTY_DATA: 'LOYALTY_DATA',
} as const

export const FeedbackTag = {
  SERVICE: 'SERVICE',
  APP: 'APP',
  QUALITY: 'QUALITY',
  ORDER: 'ORDER',
  WAITER: 'WAITER',
} as const

// Organisation status (note: intentional frontend typo preserved)
export const ORGANICATION_CUSTOMER_VERIFIED = 'ORGANICATION_CUSTOMER_VERIFIED'

// Socket event names (must match frontend exactly)
export const SocketEvent = {
  // Server → customer
  RESTAURANT_ITEM_STATUS_CHANGE: 'RESTAURANT_ITEM_STATUS_CHANGE',
  MENU_VERSION_CHANGE: 'MENU_VERSION_CHANGE',
  RECEIPT_STATE_CHANGE: 'RECEIPT_STATE_CHANGE',
  ORGANICATION_CUSTOMER_VERIFIED: 'ORGANICATION_CUSTOMER_VERIFIED',
  REWARD_REDEEMED: 'REWARD_REDEEMED',
  WALLET_CARD_ADDED: 'WALLET_CARD_ADDED',
  UPDATE_SCHEDULING_CUTOFFS: 'UPDATE_SCHEDULING_CUTOFFS',
  // Server → admin
  NEW_ORDER: 'NEW_ORDER',
  ORDER_STATE_CHANGED: 'ORDER_STATE_CHANGED',
} as const
