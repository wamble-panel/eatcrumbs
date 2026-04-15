'use client'

import { useState } from 'react'
import { adminPost } from '../../lib/api'
import { STATE, type Order, type OrderState } from '../../types'
import OrderDetailModal from './OrderDetailModal'

interface Props {
  order: Order
  isNew?: boolean
  onUpdated: (order: Order) => void
}

const STATE_BADGE_CLS: Record<OrderState, string> = {
  PENDING:            'badge-pending',
  ACCEPTED:           'badge-accepted',
  READY:              'badge-ready',
  ON_WAY_TO_PICKUP:   'badge-on-way',
  ON_WAY_TO_DELIVERY: 'badge-on-way',
  DELIVERED:          'badge-delivered',
  CANCELLED:          'badge-cancelled',
}

const STATE_LABEL: Record<OrderState, string> = {
  PENDING:            '⏳ Pending',
  ACCEPTED:           '👨‍🍳 Preparing',
  READY:              '✅ Ready',
  ON_WAY_TO_PICKUP:   '🏃 On way',
  ON_WAY_TO_DELIVERY: '🛵 Out for delivery',
  DELIVERED:          '✓ Delivered',
  CANCELLED:          '✕ Cancelled',
}

function elapsed(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`
}

export default function OrderCard({ order, isNew, onUpdated }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [quickUpdating, setQuickUpdating] = useState(false)
  const isDelivery = order.order_type === 'DELIVERY' || order.order_type === 'DELIVERYV2'
  const items = order.receipt_items ?? []

  async function quickAction(newState: OrderState) {
    setQuickUpdating(true)
    try {
      await adminPost(`/restaurant/orders/${order.id}/update-state`, { state: newState })
      onUpdated({ ...order, state: newState })
    } catch {
      // ignore — user can retry via modal
    } finally {
      setQuickUpdating(false)
    }
  }

  const summaryLine = items
    .map((i) => `${i.quantity}× ${i.name}`)
    .slice(0, 3)
    .join(', ') + (items.length > 3 ? ` +${items.length - 3} more` : '')

  return (
    <>
      <div
        className={`card${isNew ? ' new-order-pulse' : ''}`}
        style={{
          padding: 0,
          overflow: 'hidden',
          borderLeft: `4px solid var(--${
            order.state === 'PENDING'            ? 'pending'
            : order.state === 'ACCEPTED'         ? 'accepted'
            : order.state === 'READY'            ? 'ready'
            : order.state.startsWith('ON_WAY')   ? 'on-way'
            : order.state === 'DELIVERED'        ? 'delivered'
            : 'cancelled'
          })`,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px 8px',
            cursor: 'pointer',
          }}
          onClick={() => setModalOpen(true)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>#{order.order_number}</span>
            <span className={`badge ${STATE_BADGE_CLS[order.state]}`}>{STATE_LABEL[order.state]}</span>
            <span
              style={{
                fontSize: '.72rem',
                background: isDelivery ? '#ede9fe' : '#f0fdf4',
                color: isDelivery ? '#6d28d9' : '#15803d',
                borderRadius: 4,
                padding: '2px 6px',
                fontWeight: 600,
              }}
            >
              {isDelivery ? '🛵 Delivery' : '🏃 Takeout'}
            </span>
          </div>
          <span style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>{elapsed(order.created_at)}</span>
        </div>

        {/* Items summary */}
        <div
          style={{ padding: '0 16px 8px', cursor: 'pointer' }}
          onClick={() => setModalOpen(true)}
        >
          <p style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>{summaryLine}</p>
          {order.estimated_minutes && order.state === STATE.ACCEPTED && (
            <p style={{ fontSize: '.78rem', color: 'var(--primary)', marginTop: 2 }}>
              ⏱ ETA {order.estimated_minutes} min
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px 12px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
            {order.total.toFixed(2)} {order.is_paid ? '✓' : '💵'}
          </span>

          {/* Quick action buttons */}
          <div style={{ display: 'flex', gap: 6 }}>
            {order.state === STATE.PENDING && (
              <>
                <button
                  className="btn btn-success"
                  style={{ padding: '.3rem .7rem', fontSize: '.78rem' }}
                  onClick={(e) => { e.stopPropagation(); setModalOpen(true) }}
                  disabled={quickUpdating}
                >
                  Accept
                </button>
                <button
                  className="btn btn-danger"
                  style={{ padding: '.3rem .7rem', fontSize: '.78rem' }}
                  onClick={(e) => { e.stopPropagation(); quickAction(STATE.CANCELLED) }}
                  disabled={quickUpdating}
                >
                  {quickUpdating ? <span className="spinner" style={{ width: 12, height: 12 }} /> : 'Reject'}
                </button>
              </>
            )}
            {order.state === STATE.ACCEPTED && (
              <button
                className="btn btn-primary"
                style={{ padding: '.3rem .7rem', fontSize: '.78rem' }}
                onClick={(e) => { e.stopPropagation(); quickAction(STATE.READY) }}
                disabled={quickUpdating}
              >
                {quickUpdating ? <span className="spinner" style={{ width: 12, height: 12, borderTopColor: '#fff' }} /> : '🔔 Ready'}
              </button>
            )}
            {order.state === STATE.READY && (
              <button
                className="btn btn-primary"
                style={{ padding: '.3rem .7rem', fontSize: '.78rem' }}
                onClick={(e) => { e.stopPropagation(); quickAction(isDelivery ? STATE.ON_WAY_TO_DELIVERY : STATE.ON_WAY_TO_PICKUP) }}
                disabled={quickUpdating}
              >
                {quickUpdating ? <span className="spinner" style={{ width: 12, height: 12, borderTopColor: '#fff' }} /> : (isDelivery ? '🛵 Dispatch' : '✓ Picked up')}
              </button>
            )}
            {(order.state === STATE.ON_WAY_TO_DELIVERY || order.state === STATE.ON_WAY_TO_PICKUP) && (
              <button
                className="btn btn-success"
                style={{ padding: '.3rem .7rem', fontSize: '.78rem' }}
                onClick={(e) => { e.stopPropagation(); quickAction(STATE.DELIVERED) }}
                disabled={quickUpdating}
              >
                {quickUpdating ? <span className="spinner" style={{ width: 12, height: 12, borderTopColor: '#fff' }} /> : '✓ Done'}
              </button>
            )}
            <button
              className="btn btn-ghost"
              style={{ padding: '.3rem .7rem', fontSize: '.78rem' }}
              onClick={(e) => { e.stopPropagation(); setModalOpen(true) }}
            >
              Details
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <OrderDetailModal
          order={order}
          onClose={() => setModalOpen(false)}
          onUpdated={(updated) => { onUpdated(updated); setModalOpen(false) }}
        />
      )}
    </>
  )
}
