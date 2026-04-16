'use client'

import { useState, useEffect } from 'react'
import DashLayout from '../../components/DashLayout'
import { adminGet } from '../../lib/api'
import type { DashboardOverview, ItemSale, FranchiseInfo } from '../../types'

/* ── Types ─────────────────────────────────────────────────────── */
interface CustomerStats   { totalCustomers: number; newCustomers: number; repeatCustomers: number }
interface FeedbackStats   { totalFeedback: number; averageRating: number; distribution: Record<string, number> }
interface TopCustomer     { customerId: string; name: string | null; phone: string | null; orders: number; total: number }

/* ── Constants ─────────────────────────────────────────────────── */
const INTERVALS = [
  { value: 'TODAY',      label: 'Today' },
  { value: 'YESTERDAY',  label: 'Yesterday' },
  { value: 'THIS_WEEK',  label: 'This week' },
  { value: 'LAST_WEEK',  label: 'Last week' },
  { value: 'THIS_MONTH', label: 'This month' },
  { value: 'LAST_MONTH', label: 'Last month' },
  { value: 'THIS_YEAR',  label: 'This year' },
]

/* ── StatsCard with flip animation ─────────────────────────────── */
function StatsCard({ label, value, sub, color, flipped, onFlip, backContent }: {
  label: string; value: string | number; sub?: string; color?: string
  flipped?: boolean; onFlip?: () => void; backContent?: React.ReactNode
}) {
  return (
    <div className="flip-container" onClick={onFlip} style={{ cursor: onFlip ? 'pointer' : 'default', minHeight: 120 }}>
      <div className={`flip-inner${flipped ? ' flipped' : ''}`}>
        <div className="flip-front">
          <p style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
            {label}
          </p>
          <p style={{ fontWeight: 800, fontSize: '1.6rem', color: color ?? 'var(--text)', lineHeight: 1, marginBottom: 6 }}>{value}</p>
          {sub && <p style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>{sub}</p>}
        </div>
        {backContent && (
          <div className="flip-back">
            {backContent}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Donut chart ───────────────────────────────────────────────── */
function DonutChart({ data, total }: { data: { name: string; value: number; color: string }[]; total: number }) {
  const SIZE = 130, R = 46, STROKE = 15, circ = 2 * Math.PI * R
  let offset = 0
  const slices = data.map(d => {
    const pct = total > 0 ? d.value / total : 0
    const s = { ...d, pct, dashOffset: circ - offset * circ }
    offset += pct
    return s
  })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <svg width={SIZE} height={SIZE} style={{ flexShrink: 0 }}>
        <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke="var(--border)" strokeWidth={STROKE} />
        {slices.map((s, i) => (
          <circle key={i} cx={SIZE/2} cy={SIZE/2} r={R} fill="none"
            stroke={s.color} strokeWidth={STROKE}
            strokeDasharray={`${s.pct * circ} ${circ}`}
            strokeDashoffset={s.dashOffset} strokeLinecap="round"
            transform={`rotate(-90 ${SIZE/2} ${SIZE/2})`}
            style={{ transition: 'stroke-dasharray .5s' }}
          />
        ))}
        <text x={SIZE/2} y={SIZE/2+5} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--text)">{total}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.82rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--text-muted)' }}>{s.name}</span>
            <span style={{ fontWeight: 700, marginLeft: 'auto', paddingLeft: 12 }}>
              {total > 0 ? `${Math.round((s.value / total) * 100)}%` : '0%'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Page ──────────────────────────────────────────────────────── */
export default function OverviewPage() {
  const [interval,     setIntervalVal]  = useState('THIS_MONTH')
  const [franchiseId,  setFranchiseId]  = useState<number | ''>('')
  const [franchises,   setFranchises]   = useState<FranchiseInfo[]>([])
  const [overview,     setOverview]     = useState<DashboardOverview | null>(null)
  const [items,        setItems]        = useState<ItemSale[]>([])
  const [feedback,     setFeedback]     = useState<FeedbackStats | null>(null)
  const [customers,    setCustomers]    = useState<CustomerStats | null>(null)
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [flipped,      setFlipped]      = useState<Record<number, boolean>>({})

  useEffect(() => {
    adminGet<{ restaurant: object; franchises: FranchiseInfo[] }>('/info')
      .then(({ franchises: f }) => setFranchises(f)).catch(() => {})
  }, [])

  useEffect(() => { load() }, [interval, franchiseId]) // eslint-disable-line

  async function load() {
    setLoading(true); setError(null)
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
      setOverview(ov); setItems(is.items.slice(0, 10))
      setFeedback(fb); setCustomers(cs); setTopCustomers(tc.customers)
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  const toggle = (i: number) => setFlipped(p => ({ ...p, [i]: !p[i] }))

  const repeatOrders = customers?.repeatCustomers ?? 0
  const newOrders    = Math.max(0, (overview?.totalOrders ?? 0) - repeatOrders)
  const ratingDist   = feedback ? [5,4,3,2,1].map(n => ({ n, count: feedback.distribution[String(n)] ?? 0 })) : []
  const maxDist      = Math.max(...ratingDist.map(r => r.count), 1)

  return (
    <DashLayout pageTitle="Overview">
      <div style={{ padding: '24px 24px 40px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 10 }}>
          <h1 className="main-title">Overview</h1>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {franchises.length > 1 && (
              <select className="input" style={{ width: 160 }} value={franchiseId} onChange={e => setFranchiseId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">All Branches</option>
                {franchises.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            )}
            <select className="input" style={{ width: 160 }} value={interval} onChange={e => setIntervalVal(e.target.value)}>
              {INTERVALS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
            </select>
          </div>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '.875rem' }}>{error}</div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
            <div className="spinner" style={{ width: 36, height: 36 }} />
          </div>
        ) : overview && (
          <>
            {/* ── KPI Cards (flip on click for details) ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 14, marginBottom: 24 }}>
              <StatsCard label="Number of Orders" value={overview.totalOrders}
                sub={`${overview.deliveredOrders} delivered`} color="var(--primary)"
                flipped={!!flipped[0]} onFlip={() => toggle(0)}
                backContent={<><p style={{fontWeight:700,marginBottom:6}}>Orders</p><p>Delivered: {overview.deliveredOrders}</p><p>Cancelled: {overview.cancelledOrders}</p></>}
              />
              <StatsCard label="Enrolled Users" value={customers?.totalCustomers ?? 0}
                sub={`${customers?.newCustomers ?? 0} new`} color="#8b5cf6"
                flipped={!!flipped[1]} onFlip={() => toggle(1)}
                backContent={<><p style={{fontWeight:700,marginBottom:6}}>Users</p><p>Total: {customers?.totalCustomers ?? 0}</p><p>Repeat: {customers?.repeatCustomers ?? 0}</p></>}
              />
              <StatsCard label="Total Amount" value={`${overview.totalRevenue.toFixed(2)} EGP`}
                sub="Delivered orders" color="var(--primary)"
                flipped={!!flipped[2]} onFlip={() => toggle(2)}
                backContent={<><p style={{fontWeight:700,marginBottom:6}}>Revenue</p><p>Total: {overview.totalRevenue.toFixed(2)} EGP</p><p>Avg: {overview.avgOrderValue.toFixed(2)} EGP</p></>}
              />
              <StatsCard label="Average Order Size" value={`${overview.avgOrderValue.toFixed(2)} EGP`}
                sub={`${overview.deliveredOrders} orders`}
                flipped={!!flipped[3]} onFlip={() => toggle(3)}
                backContent={<><p style={{fontWeight:700,marginBottom:6}}>Avg size</p><p>Total: {overview.totalRevenue.toFixed(2)} EGP</p><p>Orders: {overview.deliveredOrders}</p></>}
              />
              {feedback && feedback.totalFeedback > 0 && (
                <StatsCard label="Overall Rating" value={`${feedback.averageRating.toFixed(1)} ★`}
                  sub={`${feedback.totalFeedback} reviews`} color="#f59e0b"
                  flipped={!!flipped[4]} onFlip={() => toggle(4)}
                  backContent={<><p style={{fontWeight:700,marginBottom:6}}>Rating dist.</p>{[5,4,3,2,1].map(n=><p key={n}>{n}★ — {feedback.distribution[String(n)]??0}</p>)}</>}
                />
              )}
            </div>

            {/* ── Charts row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginBottom: 14 }}>
              {/* Repeated Orders donut */}
              <div className="card" style={{ padding: 20 }}>
                <p style={{ fontWeight: 700, marginBottom: 16 }}>Repeated Orders</p>
                <DonutChart
                  total={overview.totalOrders}
                  data={[
                    { name: 'New',      value: newOrders,    color: 'var(--primary)' },
                    { name: 'Repeated', value: repeatOrders, color: '#8b5cf6' },
                  ]}
                />
              </div>

              {/* Rating distribution */}
              {feedback && feedback.totalFeedback > 0 && (
                <div className="card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <p style={{ fontWeight: 700 }}>Overall Rating</p>
                    <span style={{ fontWeight: 800, color: '#f59e0b' }}>{feedback.averageRating.toFixed(1)} ★</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {ratingDist.map(({ n, count }) => (
                      <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.8rem' }}>
                        <span style={{ width: 14, textAlign: 'right', color: 'var(--text-muted)', flexShrink: 0 }}>{n}</span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="#f59e0b"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${(count / maxDist) * 100}%`, height: '100%', background: '#f59e0b', borderRadius: 3, transition: 'width .4s' }} />
                        </div>
                        <span style={{ width: 28, textAlign: 'right', color: 'var(--text-muted)', flexShrink: 0 }}>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Top Customers ── */}
            {topCustomers.length > 0 && (
              <div className="card" style={{ padding: '0 0 4px', marginBottom: 14 }}>
                <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ fontWeight: 700 }}>Top {topCustomers.length} Customers</p>
                  <a href="/customers" style={{ fontSize: '.78rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>View all →</a>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 32 }}>#</th>
                      <th>Customer</th>
                      <th style={{ textAlign: 'right' }}>Orders</th>
                      <th style={{ textAlign: 'right' }}>Total (EGP)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCustomers.map((c, i) => (
                      <tr key={c.customerId}>
                        <td style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{i + 1}</td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{c.name ?? 'Guest'}</span>
                          {c.phone && <span style={{ display: 'block', fontSize: '.78rem', color: 'var(--text-muted)' }}>{c.phone}</span>}
                        </td>
                        <td style={{ textAlign: 'right' }}>{c.orders}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--primary)' }}>{c.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Top Products ── */}
            {items.length > 0 && (
              <div className="card" style={{ padding: '0 0 4px' }}>
                <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ fontWeight: 700 }}>Top {items.length} Products</p>
                  <a href="/itemsales" style={{ fontSize: '.78rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>View all →</a>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 32 }}>#</th>
                      <th>Product</th>
                      <th style={{ textAlign: 'right' }}>Units Sold</th>
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
          </>
        )}
      </div>
    </DashLayout>
  )
}
