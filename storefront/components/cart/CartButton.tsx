'use client'

import { useState } from 'react'
import { useCartStore } from '../../lib/store'
import CartDrawer from './CartDrawer'

interface Props { isRtl?: boolean; currency?: string }

export default function CartButton({ isRtl, currency = 'EGP' }: Props) {
  const [open, setOpen] = useState(false)
  const itemCount = useCartStore((s) => s.itemCount())
  const subtotal = useCartStore((s) => s.subtotal())

  if (itemCount === 0) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 90,
          background: 'var(--primary)',
          color: '#fff',
          border: 'none',
          borderRadius: 999,
          padding: '14px 28px',
          fontWeight: 700,
          fontSize: '0.95rem',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(0,0,0,.2)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            background: 'rgba(255,255,255,.25)',
            borderRadius: '50%',
            width: 26,
            height: 26,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.8rem',
            fontWeight: 800,
          }}
        >
          {itemCount}
        </span>
        {isRtl ? 'عرض السلة' : 'View cart'}
        <span style={{ opacity: 0.85 }}>
          {subtotal.toFixed(2)} {currency}
        </span>
      </button>

      {open && <CartDrawer onClose={() => setOpen(false)} isRtl={isRtl} currency={currency} />}
    </>
  )
}
