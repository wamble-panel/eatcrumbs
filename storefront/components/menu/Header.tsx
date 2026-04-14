'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useCartStore } from '../../lib/store'
import CartDrawer from '../cart/CartDrawer'
import type { Restaurant } from '../../types'

interface Props {
  restaurant: Restaurant
  isRtl?: boolean
}

export default function Header({ restaurant, isRtl }: Props) {
  const [cartOpen, setCartOpen] = useState(false)
  const itemCount = useCartStore((s) => s.itemCount())

  const name = isRtl && restaurant.nameArabic ? restaurant.nameArabic : restaurant.name

  return (
    <>
      <header
        style={{
          height: 'var(--header-h)',
          background: 'var(--card-bg)',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            maxWidth: 700,
            margin: '0 auto',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
          }}
        >
          {/* Logo + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {restaurant.logoUrl && (
              <Image
                src={restaurant.logoUrl}
                alt={name}
                width={36}
                height={36}
                style={{ borderRadius: 8, objectFit: 'cover' }}
              />
            )}
            <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{name}</span>
          </div>

          {/* Cart icon */}
          <button
            onClick={() => setCartOpen(true)}
            style={{
              position: 'relative',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 6,
            }}
            aria-label="Open cart"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            {itemCount > 0 && (
              <span
                className="badge"
                style={{ position: 'absolute', top: 0, right: 0, fontSize: '0.65rem' }}
              >
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {cartOpen && <CartDrawer onClose={() => setCartOpen(false)} isRtl={isRtl} />}
    </>
  )
}
