// ── Restaurant & Franchise ───────────────────────────────────────────────────

export interface RestaurantConfig {
  restaurantId: number
  franchiseId: number | null
  name: string
  nameArabic?: string
  logoUrl?: string
  preferredCountry?: string
  menuVersion?: number
  isFoodicsRestaurant?: boolean
  primaryColor?: string
  [key: string]: unknown
}

export interface Restaurant {
  id: number
  name: string
  nameArabic?: string
  backgroundImg?: string
  logoUrl?: string
  preferredCountry?: string
  isFoodicsRestaurant?: boolean
  config?: Record<string, unknown>
  menuVersion?: number
  mainFranchiseId?: number
}

export interface Franchise {
  id: number
  name: string
  nameArabic?: string
  slug: string
  address?: string
  lat?: number
  lng?: number
  isOnline: boolean
  busyMode: boolean
}

// ── Menu ─────────────────────────────────────────────────────────────────────

export interface AddonValue {
  id: number
  addon_group_id: number
  name: string
  name_arabic?: string
  price: number
  is_active: boolean
  sort_order: number
}

export interface AddonGroup {
  id: number
  item_id: number
  name: string
  name_arabic?: string
  is_required: boolean
  min_select: number
  max_select: number
  sort_order: number
  values: AddonValue[]
}

export interface Item {
  id: number
  category_id: number
  parent_item_id?: number | null
  name: string
  name_arabic?: string
  description?: string
  description_arabic?: string
  price: number
  image_url?: string
  sort_order: number
  is_active: boolean
  is_top_product: boolean
  calories?: number
  addonGroups: AddonGroup[]
  subItems?: Item[]
}

export interface Category {
  id: number
  name: string
  name_arabic?: string
  image_url?: string
  sort_order: number
  is_active: boolean
  items: Item[]
}

// ── Cart ─────────────────────────────────────────────────────────────────────

export interface CartAddon {
  groupId: number
  groupName: string
  groupNameArabic?: string
  valueId: number
  name: string
  nameArabic?: string
  price: number
}

export interface CartItem {
  cartId: string        // uuid for this cart entry (allows same item multiple times)
  itemId: number
  name: string
  nameArabic?: string
  price: number
  quantity: number
  addons: CartAddon[]
  notes?: string
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface Customer {
  id: string
  phone_number?: string
  person_name?: string
  email?: string
  points?: number
}

export interface AuthResponse {
  token: string
  customer: Customer
}

// ── Orders & Delivery ────────────────────────────────────────────────────────

export const ORDER_TYPE = {
  DELIVERY: 'DELIVERY',
  TAKE_OUT: 'TAKE_OUT',
  DINE_IN: 'DINE_IN',
} as const
export type OrderType = typeof ORDER_TYPE[keyof typeof ORDER_TYPE]

export const PAYMENT_METHOD = {
  CASH: 'cash',
  CARD_ON_DELIVERY: 'card_on_delivery',
  ONLINE_CARD: 'online_card',
} as const
export type PaymentMethod = typeof PAYMENT_METHOD[keyof typeof PAYMENT_METHOD]

export const RECEIPT_STATE = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  READY: 'READY',
  ON_WAY_TO_PICKUP: 'ON_WAY_TO_PICKUP',
  ON_WAY_TO_DELIVERY: 'ON_WAY_TO_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const
export type ReceiptState = typeof RECEIPT_STATE[keyof typeof RECEIPT_STATE]

export interface DeliveryAddress {
  id: number
  customer_id: string
  address_line?: string
  area?: string
  lat?: number
  lng?: number
  address_title?: string
}

export interface Receipt {
  id: string
  restaurant_id: number
  franchise_id: number
  customer_id?: string
  order_number: number
  state: ReceiptState
  order_type: OrderType
  payment_method: PaymentMethod
  subtotal: number
  delivery_fee: number
  discount: number
  total: number
  notes?: string
  estimated_minutes?: number
  is_paid: boolean
  created_at: string
  updated_at: string
}
