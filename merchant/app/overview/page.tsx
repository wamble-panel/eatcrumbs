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

interface CustomerStats {
  totalCustomers: number
  newCustomers: number
  repeatCustomers: number
}

interface FeedbackStats {
  totalFeedback: number
  averageRating: number
  distribution: Record<string, number>
}

interface TopCustomer {
  customerId: string
  name: string | null
  phone: string | null
  orders: number
  total: number
}

// ── StatsCard with 3-D flip (matches reference admin.eg.prepit.app) ───────────
function StatsCard({
  label, value, sub,
  backTitle, backRows,
  color,
  icon,
}: {
  label: string
  value: string | number
  sub?: string
  backTitle?: string
  backRows?: Array<{ label: string; value: string | number }>
  color?: string
  icon?: React.ReactNode
}) {
  const [flipped, setFlipped] = useState(false)
  return (
    <div
      className="flip-container"
      style={{ cursor: backRows ? 'pointer' : 'default', minHeight: 120 }}
      onClick={() => backRows && setFlipped(f => !f)}
    >
      <div className={`flip-inner${flipped ? ' flipped' : ''}`}>
        {/* Front */}
        <div className="flip-front" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', margin: 0 }}>{label}</p>
            {icon && <span style={{ color: color ?? 'var(--primary)', opacity: 0.7 }}>{icon}</span>}
          </div>
          <p style={{ fontWeight: 800, fontSize: '1.9rem', color: color ?? 'var(--text)', lineHeight: 1, margin: '10px 0 0' }}>{value}</p>
          {sub && <p style={{ fontSize: '.75rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>{sub}</p>}
          {backRows && <p style={{ fontSize: '.68rem', color: 'var(--text-muted)', margin: '8px 0 0', opacity: 0.6 }}>Click to flip</p>}
        </div>
        {/* Back */}
        {backRows && (
          <div className="flip-back">
            <p style={{ fontWeight: 700, fontSize: '.8rem', marginBottom: 8, opacity: 0.85 }}>{backTitle ?? label}</p>
            {backRows.map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ opacity: 0.75 }}>{r.label}</span>
                <span style={{ fontWeight: 700 }}>{r.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Donut chart ───────────────────────────────────────────────────────────────
function DonutChart({ data, total }: { data: Array<{ label: string; value: number; color: string }>; total: number }) {
  const SIZE = 130
  const R = 48
  const STROKE = 16
  const circumference = 2 * Math.PI * R
  let offset = 0
  const slices = data.map(d => {
    const pct = total > 0 ? d.value / total : 0
    const slice = { ...d, pct, dashOffset: circumference - offset * circumference }
    offset += pct
    return slice
  })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
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
            strokeLinecap="butt"
            transform={`rotate(-90 ${SIZE/2} ${SIZE/2})`}
            style={{ transition: 'stroke-dasharray .6s ease' }}
          />
        ))}
        <text x={SIZE/2} y={SIZE/2 - 6} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--text)">{total}</text>
        <text x={SIZE/2} y={SIZE/2 + 10} textAnchor="middle" fontSize={10} fill="var(--text-muted)">orders</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontSize: '.8rem', color: 'var(--text-muted)' }}>{s.label}</p>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '.95rem' }}>
                {s.value}
                <span style={{ fontWeight: 400, fontSize: '.75rem', color: 'var(--text-muted)', marginLeft: 4 }}>
                  ({total > 0 ? Math.round((s.value / total) * 100) : 0}%)
                </span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Stars ─────────────────────────────────────────────────────────────────────
function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <svg key={i} width="13" height="13" viewBox="0 0 24 24"
          fill={i <= Math.round(rating) ? '#f59e0b' : 'none'}
          stroke="#f59e0b" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ))}
    </span>
  )
}

export default function OverviewPage() {
  const [interval, setInterval]       = useState('THIS_MONTH')
  const [franchiseId, setFranchiseId] = useState<number | ''>('')
  const [franchises, setFranchises]   = useState<FranchiseInfo[]>([])
  const [overview, setOverview]       = useState<DashboardOverview | null>(null)
  const [items, setItems]             = useState<ItemSale[]>([])
  const [feedback, setFeedback]       = useState<FeedbackStats | null>(null)
  const [customers, setCustomers]     = useState<CustomerStats | null>(null)
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)

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
      const [ov, is, fb, cs, tc] = await Promise.all([
        adminGet<DashboardOverview>(`/dashboard/overview?${qs}`),
        adminGet<{ items: ItemSale[] }>(`/dashboard/item-sales?${qs}`),
        adminGet<FeedbackStats>(`/dashboard/feedback-analytics?${qs}`),
        adminGet<CustomerStats>(`/dashboard/customers-analytics?${qs}`),
        adminGet<{ customers: TopCustomer[] }>(`/dashboard/top-customers?${qs}`),
      ])
      setOverview(ov)
      setItems(is.items.slice(0, 8))
      setFeedback(fb)
      setCustomers(cs)
      setTopCustomers(tc.customers)
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  // Repeated orders donut: new customers' orders vs repeat customers' orders
  const newOrders      = overview && customers ? Math.max(0, overview.totalOrders - (customers.repeatCustomers || 0)) : 0
  const repeatedOrders = customers?.repeatCustomers ?? 0
  const donutTotal     = overview?.totalOrders ?? 0

  const donutData = [
    { label: 'New',      value: newOrders,      color: 'var(--primary)' },
    { label: 'Repeated', value: repeatedOrders, color: '#a78bfa' },
  ]

  const ratingDist = feedback
    ? [5,4,3,2,1].map(n => ({ n, count: feedback.distribution[String(n)] ?? 0 }))
    : []
  const maxDist = Math.max(...ratingDist.map(r => r.count), 1)

  return (
    <DashLayout pageTitle="Overview">
      <div style={{ padding: '24px 24px 48px' }}>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 24, gap: 10, flexWrap: 'wrap' }}>
          {franchises.length > 1 && (
            <select className="input" style={{ width: 160 }} value={franchiseId} onChange={e => setFranchiseId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">All branches</option>
              {franchises.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          )}
          <select className="input" style={{ width: 155 }} value={interval} onChange={e => setInterval(e.target.value)}>
            {INTERVALS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: '.875rem' }}>{error}</div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}>
            <div className="spinner" style={{ width: 36, height: 36 }} />
          </div>
        ) : overview ? (
          <>
            {/* ── KPI flip cards ─────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
              <StatsCard
                label="Number of orders"
                value={overview.totalOrders}
                backTitle="Order breakdown"
                backRows={[
                  { label: 'Delivered', value: overview.deliveredOrders },
                  { label: 'Cancelled', value: overview.cancelledOrders },
                  { label: 'Pending / other', value: overview.totalOrders - overview.deliveredOrders - overview.cancelledOrders },
                ]}
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>}
              />
              <StatsCard
                label="Enrolled users"
                value={customers?.totalCustomers ?? '—'}
                sub={customers ? `${customers.newCustomers} new this period` : undefined}
                color="#22c55e"
                backTitle="Customer breakdown"
                backRows={customers ? [
                  { label: 'Total enrolled', value: customers.totalCustomers },
                  { label: 'New this period', value: customers.newCustomers },
                  { label: 'Repeat customers', value: customers.repeatCustomers },
                ] : undefined}
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
              />
              <StatsCard
                label="Total amount (EGP)"
                value={overview.totalRevenue.toFixed(2)}
                color="var(--primary)"
                backTitle="Revenue breakdown"
                backRows={[
                  { label: 'Total revenue', value: `${overview.totalRevenue.toFixed(2)} EGP` },
                  { label: 'Delivered orders', value: overview.deliveredOrders },
                ]}
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
              />
              <StatsCard
                label="Avg order size (EGP)"
                value={overview.avgOrderValue.toFixed(2)}
                backTitle="Order value"
                backRows={[
                  { label: 'Average', value: `${overview.avgOrderValue.toFixed(2)} EGP` },
                  { label: 'Based on', value: `${overview.deliveredOrders} orders` },
                ]}
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
              />
              {feedback && feedback.totalFeedback > 0 && (
                <StatsCard
                  label="Overall rating"
                  value={feedback.averageRating.toFixed(1)}
                  sub={`${feedback.totalFeedback} reviews`}
                  color="#f59e0b"
                  backTitle="Rating breakdown"
                  backRows={[5,4,3,2,1].map(n => ({
                    label: `${n} ★`,
                    value: feedback.distribution[String(n)] ?? 0,
                  }))}
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}
                />
              )}
            </div>

            {/* ── Middle row: Repeated Orders donut + Rating breakdown ─ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14, marginBottom: 14 }}>

              {/* Repeated Orders donut */}
              <div className="card" style={{ padding: 22 }}>
                <p style={{ fontWeight: 700, fontSize: '.95rem', marginBottom: 18 }}>Repeated Orders</p>
                {donutTotal > 0
                  ? <DonutChart data={donutData} total={donutTotal} />
                  : <p style={{ color: 'var(--text-muted)', fontSize: '.875rem' }}>No orders yet</p>
                }
              </div>

              {/* Rating breakdown */}
              {feedback && feedback.totalFeedback > 0 && (
                <div className="card" style={{ padding: 22 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <p style={{ fontWeight: 700, fontSize: '.95rem' }}>Rating Breakdown</p>
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

            {/* ── Bottom row: Top Customers + Top Products ─────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>

              {/* Top Customers */}
              <div className="card" style={{ padding: '0 0 4px' }}>
                <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ fontWeight: 700, fontSize: '.95rem' }}>Top Customers</p>
                  <a href="/customers" style={{ fontSize: '.78rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>View all →</a>
                </div>
                {topCustomers.length === 0 ? (
                  <p style={{ padding: '24px 20px', color: 'var(--text-muted)', fontSize: '.875rem' }}>No customers yet</p>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Customer</th>
                        <th style={{ textAlign: 'right' }}>Orders</th>
                        <th style={{ textAlign: 'right' }}>Total (EGP)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topCustomers.map((c, idx) => (
                        <tr key={c.customerId}>
                          <td style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{idx + 1}</td>
                          <td>
                            <p style={{ fontWeight: 600, margin: 0 }}>{c.name ?? 'Guest'}</p>
                            {c.phone && <p style={{ fontSize: '.75rem', color: 'var(--text-muted)', margin: 0 }}>{c.phone}</p>}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{c.orders}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--primary)' }}>{c.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Top Products */}
              {items.length > 0 && (
                <div className="card" style={{ padding: '0 0 4px' }}>
                  <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ fontWeight: 700, fontSize: '.95rem' }}>Top Products</p>
                    <a href="/itemsales" style={{ fontSize: '.78rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>View all →</a>
                  </div>
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 28 }}>#</th>
                        <th>Item</th>
                        <th style={{ textAlign: 'right' }}>Units</th>
                        <th style={{ textAlign: 'right' }}>Revenue (EGP)</th>
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
            </div>
          </>
        ) : null}
      </div>
    </DashLayout>
  )
}
