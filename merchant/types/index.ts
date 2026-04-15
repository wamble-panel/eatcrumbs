// ── Auth ─────────────────────────────────────────────────────────────────────

export interface AdminPayload {
  admin_id: string
  restaurant_id: number
  role: 'owner' | 'manager' | 'staff'
  email: string
  exp?: number
}

// ── Restaurant ───────────────────────────────────────────────────────────────

export interface RestaurantInfo {
  id: number
  name: string
  logoUrl?: string
  preferredCountry?: string
  mainFranchiseId?: number
  config?: Record<string, unknown>
}

export interface FranchiseInfo {
  id: number
  name: string
  name_arabic?: string
  slug: string
  address?: string
  isOnline: boolean
  busyMode: boolean
}

// ── Orders ───────────────────────────────────────────────────────────────────

export const STATE = {
  PENDING:             'PENDING',
  ACCEPTED:            'ACCEPTED',
  READY:               'READY',
  ON_WAY_TO_PICKUP:    'ON_WAY_TO_PICKUP',
  ON_WAY_TO_DELIVERY:  'ON_WAY_TO_DELIVERY',
  DELIVERED:           'DELIVERED',
  CANCELLED:           'CANCELLED',
} as const
export type OrderState = typeof STATE[keyof typeof STATE]

export interface ReceiptItem {
  id: string
  receipt_id: string
  item_id?: number
  name: string
  name_arabic?: string
  price: number
  quantity: number
  addons?: Array<{ name: string; nameArabic?: string; price: number; quantity: number }>
  notes?: string
}

export interface Order {
  id: string
  restaurant_id: number
  franchise_id: number
  customer_id?: string | null
  order_number: number
  state: OrderState
  order_type: 'DELIVERY' | 'TAKE_OUT' | 'DINE_IN' | 'DELIVERYV2'
  payment_method: string
  subtotal: number
  delivery_fee: number
  discount: number
  total: number
  notes?: string | null
  estimated_minutes?: number | null
  is_paid: boolean
  address_snapshot?: { address_line?: string; area?: string } | null
  table_number?: string | null
  created_at: string
  updated_at: string
  receipt_items?: ReceiptItem[]
}

// ── Menu (admin schema) ──────────────────────────────────────────────────────

export interface AdminItem {
  id: number
  item_name: string
  item_name_arabic?: string | null
  description?: string | null
  description_arabic?: string | null
  price: number
  image?: string | null
  images?: string[]
  is_visible: boolean
  is_available: boolean
  sort_order: number
  is_combo: boolean
  calories?: number | null
  dietary_tags?: string[]
}

export interface AdminCategory {
  id: number
  category_name: string
  category_name_arabic?: string | null
  description?: string | null
  sort_order: number
  restaurant?: { id: number; name: string; menu_version?: string }
  itemCategories?: Array<{ item: AdminItem }>
}

// ── Branches ─────────────────────────────────────────────────────────────────

export interface Franchise {
  id: number
  name: string
  name_arabic?: string | null
  slug: string
  address?: string | null
  lat?: number | null
  lng?: number | null
  phone?: string | null
  is_online: boolean
  busy_mode: boolean
  created_at?: string
}

export interface ScheduleSlot {
  id: number
  franchise_id: number
  day_of_week: number  // 0=Sun … 6=Sat
  open_time: string    // HH:MM
  close_time: string   // HH:MM
}

// ── Analytics ────────────────────────────────────────────────────────────────

export interface DashboardOverview {
  totalRevenue: number
  totalOrders: number
  deliveredOrders: number
  cancelledOrders: number
  avgOrderValue: number
  newCustomers: number
  ordersByDay: Record<string, { orders: number; revenue: number }>
  ordersByType: Record<string, number>
}

export interface ItemSale {
  itemId: string
  name: string
  name_arabic?: string | null
  quantity: number
  revenue: number
}
