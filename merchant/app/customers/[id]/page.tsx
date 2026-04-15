'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import DashLayout from '../../../components/DashLayout'
import { adminGet, adminPost } from '../../../lib/api'

interface CustomerDetail {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  created_at: string
}

interface LoyaltyEntry {
  id: number
  type: 'EARN' | 'REDEEM' | 'ADJUST' | 'EXPIRE'
  points: number
  balance_after: number
  reason: string | null
  created_at: string
}

interface OrderSummary {
  id: string
  order_number: number
  state: string
  total: number
  created_at: string
  order_type: string
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: '.72rem', fontWeight: 700, background: `${color}20`, color }}>
      {text}
    </span>
  )
}

const STATE_COLORS: Record<string, string> = {
  DELIVERED: '#22c55e', PENDING: '#f59e0b', ACCEPTED: '#3b82f6',
  READY: '#22c55e', ON_WAY_TO_PICKUP: '#8b5cf6', ON_WAY_TO_DELIVERY: '#8b5cf6',
  CANCELLED: '#ef4444',
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [loyalty, setLoyalty] = useState<LoyaltyEntry[]>([])
  const [pointBalance, setPointBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [adjustPoints, setAdjustPoints] = useState<number | ''>('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjusting, setAdjusting] = useState(false)
  const [adjustError, setAdjustError] = useState<string | null>(null)
  const [tab, setTab] = useState<'orders' | 'loyalty'>('orders')

  useEffect(() => {
    if (!id) return
    adminPost<{ customer: CustomerDetail; orders: OrderSummary[]; loyalty: LoyaltyEntry[] }>('/customerprofiles/customer-details', { customerId: id })
      .then(({ customer: c, orders: o, loyalty: l }) => {
        setCustomer(c)
        setOrders(o)
        setLoyalty(l)
        if (l.length > 0) setPointBalance(l[0].balance_after)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  async function doAdjust() {
    if (!adjustPoints || adjustPoints === 0) return
    setAdjusting(true)
    setAdjustError(null)
    try {
      const res = await adminPost<{ newBalance: number }>(`/customers/${id}/adjust-points`, {
        points: Number(adjustPoints),
        reason: adjustReason || undefined,
      })
      setPointBalance(res.newBalance)
      setAdjustPoints('')
      setAdjustReason('')
    } catch (e: unknown) { setAdjustError((e as Error).message) }
    finally { setAdjusting(false) }
  }

  if (loading) return (
    <DashLayout pageTitle="Customer">
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" style={{ width: 32, height: 32 }} /></div>
    </DashLayout>
  )

  if (!customer) return (
    <DashLayout pageTitle="Customer">
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        <p>Customer not found.</p>
        <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => router.back()}>← Back</button>
      </div>
    </DashLayout>
  )

  const totalSpend = orders.filter(o => o.state === 'DELIVERED').reduce((s, o) => s + o.total, 0)

  return (
    <DashLayout pageTitle={customer.name ?? 'Customer'}>
      <div style={{ padding: '24px 24px 40px' }}>
        {/* Back */}
        <button className="btn btn-ghost" style={{ fontSize: '.8rem', marginBottom: 20 }} onClick={() => router.push('/customers')}>
          ← All customers
        </button>

        {/* Profile card */}
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'var(--primary)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: '1.3rem', flexShrink: 0,
            }}>
              {(customer.name ?? '?')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 4 }}>{customer.name ?? 'Unknown'}</p>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '.83rem', color: 'var(--text-muted)' }}>
                {customer.phone && <span style={{ direction: 'ltr' }}>{customer.phone}</span>}
                {customer.email && <span>{customer.email}</span>}
                <span>Joined {new Date(customer.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: 800, fontSize: '1.4rem', color: 'var(--primary)' }}>{orders.length}</p>
                <p style={{ fontSize: '.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Orders</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: 800, fontSize: '1.4rem' }}>{totalSpend.toFixed(2)}</p>
                <p style={{ fontSize: '.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total spent</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: 800, fontSize: '1.4rem', color: '#f59e0b' }}>{pointBalance}</p>
                <p style={{ fontSize: '.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Points</p>
              </div>
            </div>
          </div>
        </div>

        {/* Adjust points */}
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <p style={{ fontWeight: 700, fontSize: '.9rem', marginBottom: 12 }}>Adjust Points</p>
          {adjustError && <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: '.8rem' }}>{adjustError}</div>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ marginBottom: 0, flex: '0 0 120px' }}>
              <label>Points (+ or -)</label>
              <input className="input" type="number" placeholder="e.g. -50 or 100" value={adjustPoints} onChange={e => setAdjustPoints(e.target.value ? Number(e.target.value) : '')} />
            </div>
            <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>
              <label>Reason (optional)</label>
              <input className="input" placeholder="Goodwill adjustment…" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} />
            </div>
            <button className="btn btn-primary" style={{ fontSize: '.85rem' }} disabled={adjusting || !adjustPoints} onClick={doAdjust}>
              {adjusting ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : 'Apply'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid var(--border)' }}>
          {(['orders', 'loyalty'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 16px', fontSize: '.875rem',
              fontWeight: tab === t ? 700 : 500,
              color: tab === t ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: `2px solid ${tab === t ? 'var(--primary)' : 'transparent'}`,
              marginBottom: -2, textTransform: 'capitalize',
            }}>{t}</button>
          ))}
        </div>

        {tab === 'orders' && (
          orders.length === 0 ? (
            <div className="card" style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>No orders yet.</div>
          ) : (
            <div className="card" style={{ padding: '0 0 4px' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id}>
                      <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>#{o.order_number}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>{o.order_type.replace(/_/g, ' ')}</td>
                      <td><Badge text={o.state.replace(/_/g, ' ')} color={STATE_COLORS[o.state] ?? '#64748b'} /></td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{o.total.toFixed(2)}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>
                        {new Date(o.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {tab === 'loyalty' && (
          loyalty.length === 0 ? (
            <div className="card" style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>No loyalty activity yet.</div>
          ) : (
            <div className="card" style={{ padding: '0 0 4px' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Points</th>
                    <th>Balance after</th>
                    <th>Reason</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {loyalty.map(l => (
                    <tr key={l.id}>
                      <td>
                        <Badge
                          text={l.type}
                          color={l.type === 'EARN' ? '#22c55e' : l.type === 'REDEEM' ? '#8b5cf6' : l.type === 'EXPIRE' ? '#ef4444' : '#f59e0b'}
                        />
                      </td>
                      <td style={{ fontWeight: 700, color: l.points >= 0 ? '#22c55e' : '#ef4444' }}>
                        {l.points >= 0 ? '+' : ''}{l.points}
                      </td>
                      <td style={{ fontWeight: 600 }}>{l.balance_after}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>{l.reason ?? '—'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>
                        {new Date(l.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </DashLayout>
  )
}
