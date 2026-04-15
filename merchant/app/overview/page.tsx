'use client'

import { useState, useEffect } from 'react'
import DashLayout from '../../components/DashLayout'
import { adminGet } from '../../lib/api'
import type { DashboardOverview, ItemSale, FranchiseInfo } from '../../types'

const INTERVALS = [
  { value: 'TODAY',      label: 'Today' },
  { value: 'YESTERDAY',  label: 'Yesterday' },
  { value: 'THIS_WEEK',  label: 'This week' },
  { value: 'LAST_WEEK',  label: 'Last week' },
  { value: 'THIS_MONTH', label: 'This month' },
  { value: 'LAST_MONTH', label: 'Last month' },
  { value: 'THIS_YEAR',  label: 'This year' },
]

interface FeedbackStats {
  totalFeedback: number
  averageRating: number
  distribution: Record<string, number>
}

interface CustomerStats {
  totalCustomers: number
  newCustomers: number
  repeatCustomers: number
}

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={i <= Math.round(rating) ? '#f59e0b' : 'none'} stroke="#f59e0b" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ))}
    </span>
  )
}

function KpiCard({ label, value, sub, color, icon }: { label: string; value: string | number; sub?: string; color?: string; icon?: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</p>
        {icon && <span style={{ color: color ?? 'var(--primary)', opacity: 0.7 }}>{icon}</span>}
      </div>
      <p style={{ fontWeight: 800, fontSize: '1.75rem', color: color ?? 'var(--text)', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginTop: -4 }}>{sub}</p>}
    </div>
  )
}

function DonutChart({ data, total }: { data: Array<{ label: string; value: number; color: string }>; total: number }) {
  const SIZE = 120
  const R = 44
  const STROKE = 14
  const circumference = 2 * Math.PI * R

  let offset = 0
  const slices = data.map(d => {
    const pct = total > 0 ? d.value / total : 0
    const dash = pct * circumference
    const slice = { ...d, pct, dashOffset: circumference - offset * circumference }
    offset += pct
    return slice
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
      <svg width={SIZE} height={SIZE} style={{ flexShrink: 0 }}>
        <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke="var(--border)" strokeWidth={STROKE} />
        {slices.map((s, i) => (
          <circle
            key={i}
            cx={SIZE/2} cy={SIZE/2} r={R}
            fill="none"
            stroke={s.color}
            strokeWidth={STROKE}
            strokeDasharray={`${s.pct * circumference} ${circumference}`}
            strokeDashoffset={s.dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${SIZE/2} ${SIZE/2})`}
            style={{ transition: 'stroke-dasharray .5s ease' }}
          />
        ))}
        <text x={SIZE/2} y={SIZE/2 + 5} textAnchor="middle" fontSize={14} fontWeight={700} fill="var(--text)">{total}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.8rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--text-muted)' }}>{s.label}</span>
            <span style={{ fontWeight: 700, marginLeft: 'auto', paddingLeft: 8 }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function OverviewPage() {
  const [interval, setInterval] = useState('THIS_MONTH')
  const [franchiseId, setFranchiseId] = useState<number | ''>('')
  const [franchises, setFranchises] = useState<FranchiseInfo[]>([])
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [items, setItems] = useState<ItemSale[]>([])
  const [feedback, setFeedback] = useState<FeedbackStats | null>(null)
  const [customers, setCustomers] = useState<CustomerStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    adminGet<{ restaurant: object; franchises: FranchiseInfo[] }>('/info')
      .then(({ franchises: f }) => setFranchises(f))
      .catch(() => {})
  }, [])

  useEffect(() => { load() }, [interval, franchiseId]) // eslint-disable-line

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ timeInterval: interval })
      if (franchiseId) qs.set('franchiseId', String(franchiseId))
      const [ov, is, fb, cs] = await Promise.all([
        adminGet<DashboardOverview>(`/dashboard/overview?${qs}`),
        adminGet<{ items: ItemSale[] }>(`/dashboard/item-sales?${qs}`),
        adminGet<FeedbackStats>(`/dashboard/feedback-analytics?${qs}`),
        adminGet<CustomerStats>(`/dashboard/customers-analytics?${qs}`),
      ])
      setOverview(ov)
      setItems(is.items.slice(0, 8))
      setFeedback(fb)
      setCustomers(cs)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const TYPE_COLORS: Record<string, string> = {
    DELIVERY: '#8b5cf6', DELIVERYV2: '#8b5cf6',
    TAKE_OUT: '#22c55e', DINE_IN: '#f59e0b',
  }
  const orderTypeData = overview
    ? Object.entries(overview.ordersByType).map(([k, v]) => ({
        label: k.replace(/_/g, ' '), value: v as number,
        color: TYPE_COLORS[k] ?? 'var(--primary)',
      }))
    : []

  const ratingDist = feedback
    ? [5,4,3,2,1].map(n => ({ n, count: feedback.distribution[String(n)] ?? 0 }))
    : []
  const maxDist = Math.max(...ratingDist.map(r => r.count), 1)

  return (
    <DashLayout pageTitle="Overview">
      <div style={{ padding: '24px 24px 40px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 10 }}>
          <h1 style={{ fontWeight: 800, fontSize: '1.4rem' }}>Overview</h1>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {franchises.length > 1 && (
              <select className="input" style={{ width: 160 }} value={franchiseId} onChange={e => setFranchiseId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">All branches</option>
                {franchises.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            )}
            <select className="input" style={{ width: 160 }} value={interval} onChange={e => setInterval(e.target.value)}>
              {INTERVALS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
            </select>
          </div>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '.875rem' }}>{error}</div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" style={{ width: 32, height: 32 }} /></div>
        ) : overview && (
          <>
            {/* KPI Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
              <KpiCard
                label="Total Revenue"
                value={overview.totalRevenue.toFixed(2)}
                sub={`${overview.totalOrders} orders`}
                color="var(--primary)"
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
              />
              <KpiCard
                label="Total Orders"
                value={overview.totalOrders}
                sub={`${overview.cancelledOrders} cancelled`}
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>}
              />
              <KpiCard
                label="Avg Order Value"
                value={overview.avgOrderValue.toFixed(2)}
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
              />
              <KpiCard
                label="New Customers"
                value={overview.newCustomers}
                sub={customers ? `${customers.repeatCustomers} returning` : undefined}
                color="#22c55e"
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
              />
              <KpiCard
                label="Completion Rate"
                value={overview.totalOrders > 0 ? `${Math.round((overview.deliveredOrders / overview.totalOrders) * 100)}%` : '—'}
                sub={`${overview.deliveredOrders} delivered`}
                color="#22c55e"
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>}
              />
              {feedback && feedback.totalFeedback > 0 && (
                <KpiCard
                  label="Avg Rating"
                  value={feedback.averageRating.toFixed(1)}
                  sub={`${feedback.totalFeedback} reviews`}
                  color="#f59e0b"
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}
                />
              )}
            </div>

            {/* Middle row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              {/* Order types donut */}
              <div className="card" style={{ padding: 20 }}>
                <p style={{ fontWeight: 700, marginBottom: 16, fontSize: '.9rem' }}>Order Types</p>
                {orderTypeData.length > 0
                  ? <DonutChart data={orderTypeData} total={overview.totalOrders} />
                  : <p style={{ color: 'var(--text-muted)', fontSize: '.875rem' }}>No orders</p>}
              </div>

              {/* Rating distribution */}
              {feedback && (
                <div className="card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <p style={{ fontWeight: 700, fontSize: '.9rem' }}>Rating Breakdown</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Stars rating={feedback.averageRating} />
                      <span style={{ fontWeight: 700, fontSize: '.9rem' }}>{feedback.averageRating.toFixed(1)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {ratingDist.map(({ n, count }) => (
                      <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.8rem' }}>
                        <span style={{ width: 14, textAlign: 'right', color: 'var(--text-muted)', flexShrink: 0 }}>{n}</span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="#f59e0b" style={{ flexShrink: 0 }}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${(count / maxDist) * 100}%`, height: '100%', background: '#f59e0b', borderRadius: 3, transition: 'width .4s ease' }} />
                        </div>
                        <span style={{ width: 28, textAlign: 'right', color: 'var(--text-muted)', flexShrink: 0 }}>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Top items */}
            {items.length > 0 && (
              <div className="card" style={{ padding: '0 0 4px' }}>
                <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ fontWeight: 700, fontSize: '.9rem' }}>Top Items</p>
                  <a href="/itemsales" style={{ fontSize: '.78rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>View all →</a>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 32 }}>#</th>
                      <th>Item</th>
                      <th style={{ textAlign: 'right' }}>Units sold</th>
                      <th style={{ textAlign: 'right' }}>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={item.itemId}>
                        <td style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{idx + 1}</td>
                        <td style={{ fontWeight: 500 }}>{item.name}</td>
                        <td style={{ textAlign: 'right' }}>{item.quantity}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--primary)' }}>{item.revenue.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </DashLayout>
  )
}
