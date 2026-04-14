'use client'

import { useState } from 'react'
import { adminPost } from '../../lib/api'
import { STATE, type Order, type OrderState } from '../../types'

interface Props {
  order: Order
  onClose: () => void
  onUpdated: (order: Order) => void
}

const STATE_LABEL: Record<OrderState, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  READY: 'Ready',
  ON_WAY_TO_PICKUP: 'On way to pickup',
  ON_WAY_TO_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

function nextStates(order: Order): Array<{ state: OrderState; label: string; cls: string }> {
  const isDelivery = order.order_type === 'DELIVERY' || order.order_type === 'DELIVERYV2'
  switch (order.state) {
    case STATE.PENDING:
      return [
        { state: STATE.ACCEPTED, label: '✓ Accept', cls: 'btn-success' },
        { state: STATE.CANCELLED, label: '✕ Reject', cls: 'btn-danger' },
      ]
    case STATE.ACCEPTED:
      return [{ state: STATE.READY, label: '🔔 Mark ready', cls: 'btn-primary' }]
    case STATE.READY:
      return isDelivery
        ? [{ state: STATE.ON_WAY_TO_DELIVERY, label: '🛵 Out for delivery', cls: 'btn-primary' }]
        : [{ state: STATE.ON_WAY_TO_PICKUP, label: '✓ Picked up', cls: 'btn-success' }]
    case STATE.ON_WAY_TO_DELIVERY:
    case STATE.ON_WAY_TO_PICKUP:
      return [{ state: STATE.DELIVERED, label: '✓ Delivered', cls: 'btn-success' }]
    default:
      return []
  }
}

export default function OrderDetailModal({ order, onClose, onUpdated }: Props) {
  const [updating, setUpdating] = useState(false)
  const [eta, setEta] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const actions = nextStates(order)
  const isDelivery = order.order_type === 'DELIVERY' || order.order_type === 'DELIVERYV2'

  async function handleStateUpdate(newState: OrderState) {
    setUpdating(true)
    setError(null)
    try {
      const body: Record<string, unknown> = { state: newState }
      if (eta && newState === STATE.ACCEPTED) {
        const mins = parseInt(eta, 10)
        if (!isNaN(mins)) body.estimatedMinutes = mins
      }
      await adminPost(`/restaurant/orders/${order.id}/update-state`, body)
      onUpdated({ ...order, state: newState, estimated_minutes: body.estimatedMinutes as number | undefined ?? order.estimated_minutes })
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setUpdating(false)
    }
  }

  const addr = order.address_snapshot

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 560 }}>
        {/* Header */}
        <div className="modal-header" style={{ paddingBottom: 16 }}>
          <div>
            <h2 style={{ fontWeight: 700, fontSize: '1.1rem' }}>Order #{order.order_number}</h2>
            <p style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {new Date(order.created_at).toLocaleTimeString()} · {order.order_type.replace('_', ' ')}
              {isDelivery && addr?.area && ` · ${addr.area}`}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.3rem', color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ paddingTop: 0 }}>
          {/* Items */}
          <h3 style={{ fontWeight: 700, fontSize: '.875rem', marginBottom: 10 }}>Items</h3>
          <div style={{ marginBottom: 16 }}>
            {(order.receipt_items ?? []).map((ri, i) => (
              <div
                key={ri.id ?? i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  padding: '8px 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 500 }}>{ri.quantity}× {ri.name}</p>
                  {ri.addons && ri.addons.length > 0 && (
                    <p style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {ri.addons.map((a) => a.name).join(', ')}
                    </p>
                  )}
                  {ri.notes && (
                    <p style={{ fontSize: '.78rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 2 }}>
                      Note: {ri.notes}
                    </p>
                  )}
                </div>
                <span style={{ fontWeight: 600, fontSize: '.875rem', marginLeft: 12 }}>
                  {(ri.price * ri.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
            {[
              { label: 'Subtotal', value: order.subtotal },
              ...(order.delivery_fee > 0 ? [{ label: 'Delivery fee', value: order.delivery_fee }] : []),
              ...(order.discount > 0 ? [{ label: 'Discount', value: -order.discount }] : []),
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '.875rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span>{value >= 0 ? value.toFixed(2) : `(${Math.abs(value).toFixed(2)})`}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
              <span>Total</span>
              <span style={{ color: 'var(--primary)' }}>{order.total.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '.8rem', color: 'var(--text-muted)' }}>
              <span>Payment</span>
              <span>{order.payment_method.replace(/_/g, ' ')} · {order.is_paid ? '✓ Paid' : 'Unpaid'}</span>
            </div>
          </div>

          {/* Delivery address */}
          {isDelivery && addr && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontWeight: 600, fontSize: '.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>DELIVERY TO</p>
              <p style={{ fontSize: '.875rem' }}>
                {addr.address_line ?? addr.area ?? 'Address not available'}
              </p>
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontWeight: 600, fontSize: '.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>ORDER NOTES</p>
              <p style={{ fontSize: '.875rem', fontStyle: 'italic' }}>{order.notes}</p>
            </div>
          )}

          {/* ETA input (shown when PENDING) */}
          {order.state === STATE.PENDING && (
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Estimated prep time (minutes, optional)</label>
              <input
                className="input"
                type="number"
                min={1}
                placeholder="e.g. 20"
                value={eta}
                onChange={(e) => setEta(e.target.value)}
                style={{ width: 150 }}
              />
            </div>
          )}

          {error && (
            <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '8px 12px', fontSize: '.85rem', marginBottom: 12 }}>
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        {actions.length > 0 && (
          <div className="modal-footer">
            {actions.map(({ state, label, cls }) => (
              <button
                key={state}
                className={`btn ${cls}`}
                onClick={() => handleStateUpdate(state)}
                disabled={updating}
              >
                {updating ? <span className="spinner" style={{ borderTopColor: 'currentColor' }} /> : label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
