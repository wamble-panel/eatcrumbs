'use client'

import { useState, useEffect } from 'react'
import { adminGet } from '../../lib/api'
import type { DashboardOverview, ItemSale, FranchiseInfo } from '../../types'

const INTERVALS = [
  { value: 'TODAY',          label: 'Today' },
  { value: 'YESTERDAY',      label: 'Yesterday' },
  { value: 'THIS_WEEK',      label: 'This week' },
  { value: 'LAST_WEEK',      label: 'Last week' },
  { value: 'THIS_MONTH',     label: 'This month' },
  { value: 'LAST_MONTH',     label: 'Last month' },
  { value: 'THIS_YEAR',      label: 'This year' },
]

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="card" style={{ padding: '20px 22px' }}>
      <p style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>
        {label}
      </p>
      <p style={{ fontWeight: 800, fontSize: '1.6rem', color: color ?? 'var(--text)' }}>{value}</p>
      {sub && <p style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginTop: 4 }}>{sub}</p>}
    </div>
  )
}

function BarChart({ data }: { data: Array<{ label: string; orders: number; revenue: number }> }) {
  const maxOrders = Math.max(...data.map((d) => d.orders), 1)
  const barW = 28
  const gap = 10
  const svgW = data.length * (barW + gap)
  const svgH = 100

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${Math.max(svgW, 300)} ${svgH + 20}`} style={{ width: '100%', minWidth: 200, height: svgH + 20 }}>
        {data.map((d, i) => {
          const h = Math.max(4, (d.orders / maxOrders) * (svgH - 10))
          const x = i * (barW + gap) + gap / 2
          const y = svgH - h - 2
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={h} fill="var(--primary)" rx={4} opacity={0.85} />
              <text x={x + barW / 2} y={svgH + 14} textAnchor="middle" fontSize={8} fill="var(--text-muted)">
                {d.label}
              </text>
              {d.orders > 0 && (
                <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize={8} fill="var(--text-muted)">
                  {d.orders}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function OrderTypePie({ byType }: { byType: Record<string, number> }) {
  const total = Object.values(byType).reduce((s, v) => s + v, 0)
  if (total === 0) return <p style={{ color: 'var(--text-muted)', fontSize: '.875rem' }}>No orders</p>

  const COLORS: Record<string, string> = {
    DELIVERY: '#8b5cf6',
    DELIVERYV2: '#8b5cf6',
    TAKE_OUT: '#22c55e',
    DINE_IN: '#f59e0b',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Object.entries(byType).map(([type, count]) => (
        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: `${Math.max(4, (count / total) * 100)}%`,
              height: 8,
              background: COLORS[type] ?? 'var(--primary)',
              borderRadius: 4,
              minWidth: 4,
              maxWidth: '100%',
            }}
          />
          <span style={{ fontSize: '.8rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {type.replace(/_/g, ' ')} ({count})
          </span>
        </div>
      ))}
    </div>
  )
}

interface Props {
  franchises: FranchiseInfo[]
}

export default function AnalyticsDashboard({ franchises }: Props) {
  const [interval, setInterval] = useState('THIS_MONTH')
  const [franchiseId, setFranchiseId] = useState<number | ''>('')
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [items, setItems] = useState<ItemSale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ timeInterval: interval })
      if (franchiseId) qs.set('franchiseId', String(franchiseId))

      const [ov, is] = await Promise.all([
        adminGet<DashboardOverview>(`/dashboard/overview?${qs}`),
        adminGet<{ items: ItemSale[] }>(`/dashboard/item-sales?${qs}`),
      ])
      setOverview(ov)
      setItems(is.items.slice(0, 10))
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [interval, franchiseId]) // eslint-disable-line

  // Build bar chart data from ordersByDay (last 14 days or available range)
  const chartData = overview
    ? Object.entries(overview.ordersByDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-14)
        .map(([date, v]) => ({
          label: date.slice(5),          // MM-DD
          orders: v.orders,
          revenue: v.revenue,
        }))
    : []

  return (
    <div>
      {/* Header + filters */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontWeight: 800, fontSize: '1.4rem' }}>Analytics</h1>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {franchises.length > 1 && (
            <select className="input" style={{ width: 160 }} value={franchiseId} onChange={(e) => setFranchiseId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">All branches</option>
              {franchises.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          )}
          <select className="input" style={{ width: 160 }} value={interval} onChange={(e) => setInterval(e.target.value)}>
            {INTERVALS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '.875rem' }}>{error}</div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
      ) : overview && (
        <>
          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12, marginBottom: 24 }}>
            <StatCard label="Revenue" value={`${overview.totalRevenue.toFixed(0)}`} sub={`${overview.deliveredOrders} orders`} color="var(--primary)" />
            <StatCard label="Total orders" value={overview.totalOrders} sub={`${overview.cancelledOrders} cancelled`} />
            <StatCard label="Avg order value" value={overview.avgOrderValue.toFixed(2)} />
            <StatCard label="New customers" value={overview.newCustomers} />
            <StatCard
              label="Completion rate"
              value={overview.totalOrders > 0
                ? `${Math.round((overview.deliveredOrders / overview.totalOrders) * 100)}%`
                : '—'}
              color={overview.totalOrders > 0 && (overview.deliveredOrders / overview.totalOrders) > 0.8 ? '#22c55e' : undefined}
            />
          </div>

          {/* Charts row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 24 }}>
            <div className="card" style={{ padding: '20px' }}>
              <p style={{ fontWeight: 700, marginBottom: 14 }}>Orders per day</p>
              {chartData.length > 0
                ? <BarChart data={chartData} />
                : <p style={{ color: 'var(--text-muted)', fontSize: '.875rem' }}>No data for this period</p>}
            </div>
            <div className="card" style={{ padding: '20px' }}>
              <p style={{ fontWeight: 700, marginBottom: 14 }}>Order types</p>
              <OrderTypePie byType={overview.ordersByType} />
            </div>
          </div>

          {/* Top items */}
          {items.length > 0 && (
            <div className="card" style={{ padding: '0 0 4px' }}>
              <div style={{ padding: '16px 20px 0' }}>
                <p style={{ fontWeight: 700 }}>Top items</p>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th style={{ textAlign: 'right' }}>Units sold</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.itemId}>
                      <td style={{ color: 'var(--text-muted)', fontWeight: 700, width: 32 }}>{idx + 1}</td>
                      <td style={{ fontWeight: 500 }}>{item.name}</td>
                      <td style={{ textAlign: 'right' }}>{item.quantity}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
