import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, CartAddon } from '../types'

interface CartState {
  items: CartItem[]
  restaurantId: number | null
  franchiseId: number | null

  addItem: (item: Omit<CartItem, 'cartId'>) => void
  removeItem: (cartId: string) => void
  updateQuantity: (cartId: string, quantity: number) => void
  clearCart: () => void
  setContext: (restaurantId: number, franchiseId: number) => void

  subtotal: () => number
  itemCount: () => number
}

let idCounter = 0
function makeCartId() {
  return `cart-${Date.now()}-${++idCounter}`
}

function itemLineTotal(item: CartItem): number {
  const addonsTotal = item.addons.reduce((s: number, a: CartAddon) => s + a.price, 0)
  return (item.price + addonsTotal) * item.quantity
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      restaurantId: null,
      franchiseId: null,

      addItem: (item) =>
        set((state) => ({
          items: [...state.items, { ...item, cartId: makeCartId() }],
        })),

      removeItem: (cartId) =>
        set((state) => ({
          items: state.items.filter((i) => i.cartId !== cartId),
        })),

      updateQuantity: (cartId, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.cartId !== cartId)
              : state.items.map((i) =>
                  i.cartId === cartId ? { ...i, quantity } : i,
                ),
        })),

      clearCart: () => set({ items: [] }),

      setContext: (restaurantId, franchiseId) => set({ restaurantId, franchiseId }),

      subtotal: () =>
        get().items.reduce((sum, item) => sum + itemLineTotal(item), 0),

      itemCount: () =>
        get().items.reduce((sum, item) => sum + item.quantity, 0),
    }),
    { name: 'sf-cart' },
  ),
)
