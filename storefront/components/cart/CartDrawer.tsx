'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCartStore } from '../../lib/store'
import type { CartItem } from '../../types'

interface Props {
  onClose: () => void
  isRtl?: boolean
  currency?: string
}

function CartRow({
  item,
  isRtl,
  currency,
  onUpdate,
  onRemove,
}: {
  item: CartItem
  isRtl?: boolean
  currency: string
  onUpdate: (qty: number) => void
  onRemove: () => void
}) {
  const name = isRtl && item.nameArabic ? item.nameArabic : item.name
  const addonsTotal = item.addons.reduce((s, a) => s + a.price, 0)
  const lineTotal = (item.price + addonsTotal) * item.quantity

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '14px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>{name}</p>
        {item.addons.length > 0 && (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>
            {item.addons
              .map((a) => (isRtl && a.nameArabic ? a.nameArabic : a.name))
              .join(', ')}
          </p>
        )}
        {item.notes && (
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            {item.notes}
          </p>
        )}
        <p style={{ fontWeight: 700, color: 'var(--primary)', marginTop: 4, fontSize: '0.9rem' }}>
          {lineTotal.toFixed(2)} {currency}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        {/* Qty controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            border: '1.5px solid var(--border)',
            borderRadius: 999,
            padding: '4px 10px',
          }}
        >
          <button
            onClick={() => item.quantity === 1 ? onRemove() : onUpdate(item.quantity - 1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '1rem' }}
          >
            −
          </button>
          <span style={{ fontWeight: 700, minWidth: 18, textAlign: 'center' }}>{item.quantity}</span>
          <button
            onClick={() => onUpdate(item.quantity + 1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '1rem' }}
          >
            +
          </button>
        </div>

        <button
          onClick={onRemove}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem' }}
        >
          {isRtl ? 'حذف' : 'Remove'}
        </button>
      </div>
    </div>
  )
}

export default function CartDrawer({ onClose, isRtl, currency = 'EGP' }: Props) {
  const items = useCartStore((s) => s.items)
  const subtotal = useCartStore((s) => s.subtotal())
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const clearCart = useCartStore((s) => s.clearCart)
  const router = useRouter()

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function handleCheckout() {
    onClose()
    router.push('/checkout')
  }

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer-panel">
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            position: 'sticky',
            top: 0,
            background: 'var(--card-bg)',
            zIndex: 1,
          }}
        >
          <h2 style={{ fontWeight: 700 }}>{isRtl ? 'سلة الطلبات' : 'Your cart'}</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.4rem', color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>

        {/* Items */}
        <div style={{ padding: '0 20px', flex: 1 }}>
          {items.length === 0 ? (
            <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              {isRtl ? 'السلة فارغة' : 'Your cart is empty'}
            </div>
          ) : (
            <>
              {items.map((item) => (
                <CartRow
                  key={item.cartId}
                  item={item}
                  isRtl={isRtl}
                  currency={currency}
                  onUpdate={(qty) => updateQuantity(item.cartId, qty)}
                  onRemove={() => removeItem(item.cartId)}
                />
              ))}

              <button
                onClick={() => clearCart()}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem',
                  marginTop: 12,
                  textDecoration: 'underline',
                }}
              >
                {isRtl ? 'إفراغ السلة' : 'Clear cart'}
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div
            style={{
              position: 'sticky',
              bottom: 0,
              background: 'var(--card-bg)',
              borderTop: '1px solid var(--border)',
              padding: 20,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontWeight: 600 }}>{isRtl ? 'المجموع' : 'Subtotal'}</span>
              <span style={{ fontWeight: 700 }}>{subtotal.toFixed(2)} {currency}</span>
            </div>
            <button onClick={handleCheckout} className="btn-primary" style={{ width: '100%' }}>
              {isRtl ? 'متابعة الطلب' : 'Continue to checkout'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
