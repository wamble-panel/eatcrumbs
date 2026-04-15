'use client'

import { useState, useEffect, useCallback } from 'react'
import DashLayout from '../../components/DashLayout'
import { adminGet } from '../../lib/api'
import type { ItemSale, FranchiseInfo } from '../../types'

const INTERVALS = [
  { value: 'TODAY',      label: 'Today' },
  { value: 'YESTERDAY',  label: 'Yesterday' },
  { value: 'THIS_WEEK',  label: 'This week' },
  { value: 'LAST_WEEK',  label: 'Last week' },
  { value: 'THIS_MONTH', label: 'This month' },
  { value: 'LAST_MONTH', label: 'Last month' },
  { value: 'THIS_YEAR',  label: 'This year' },
]

export default function ItemSalesPage() {
  const [interval, setInterval] = useState('THIS_MONTH')
  const [franchiseId, setFranchiseId] = useState<number | ''>('')
  const [franchises, setFranchises] = useState<FranchiseInfo[]>([])
  const [items, setItems] = useState<ItemSale[]>([])
  const [filtered, setFiltered] = useState<ItemSale[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'quantity' | 'revenue'>('quantity')

  useEffect(() => {
    adminGet<{ restaurant: object; franchises: FranchiseInfo[] }>('/info')
      .then(({ franchises: f }) => setFranchises(f))
      .catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ timeInterval: interval })
      if (franchiseId) qs.set('franchiseId', String(franchiseId))
      const res = await adminGet<{ items: ItemSale[] }>(`/dashboard/item-sales?${qs}`)
      setItems(res.items)
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [interval, franchiseId])

  useEffect(() => { load() }, [load])

  // Filter + sort
  useEffect(() => {
    let result = [...items]
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(i => i.name.toLowerCase().includes(q) || (i.name_arabic ?? '').toLowerCase().includes(q))
    }
    result.sort((a, b) => sortBy === 'quantity' ? b.quantity - a.quantity : b.revenue - a.revenue)
    setFiltered(result)
  }, [items, search, sortBy])

  const totalUnits = items.reduce((s, i) => s + i.quantity, 0)
  const totalRevenue = items.reduce((s, i) => s + i.revenue, 0)
  const maxQuantity = Math.max(...items.map(i => i.quantity), 1)

  return (
    <DashLayout pageTitle="Item Sales">
      <div style={{ padding: '24px 24px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <h1 style={{ fontWeight: 800, fontSize: '1.4rem' }}>Item Sales</h1>
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

        {/* Summary */}
        {!loading && items.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Unique Items', value: items.length },
              { label: 'Total Units Sold', value: totalUnits.toLocaleString() },
              { label: 'Total Revenue', value: totalRevenue.toFixed(2), color: 'var(--primary)' },
              { label: 'Avg per Item', value: items.length > 0 ? (totalRevenue / items.length).toFixed(2) : '—' },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: '16px 18px' }}>
                <p style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{s.label}</p>
                <p style={{ fontWeight: 800, fontSize: '1.4rem', color: s.color ?? 'var(--text)' }}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Search + sort */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 360 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input className="input" style={{ paddingLeft: 32 }} placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ display: 'flex', border: '1.5px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {(['quantity', 'revenue'] as const).map(s => (
              <button key={s} onClick={() => setSortBy(s)} style={{
                padding: '6px 14px', background: sortBy === s ? 'var(--primary)' : 'transparent',
                color: sortBy === s ? '#fff' : 'var(--text-muted)', border: 'none', cursor: 'pointer',
                fontSize: '.8rem', fontWeight: 600, transition: 'all .15s',
              }}>
                {s === 'quantity' ? 'By units' : 'By revenue'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p>{search ? `No items matching "${search}"` : 'No sales data for this period.'}</p>
          </div>
        ) : (
          <div className="card" style={{ padding: '0 0 4px' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Item</th>
                  <th style={{ textAlign: 'right' }}>Units sold</th>
                  <th style={{ width: '30%' }}>Share</th>
                  <th style={{ textAlign: 'right' }}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => (
                  <tr key={item.itemId}>
                    <td style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{idx + 1}</td>
                    <td>
                      <p style={{ fontWeight: 600, fontSize: '.875rem' }}>{item.name}</p>
                      {item.name_arabic && <p style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>{item.name_arabic}</p>}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{item.quantity.toLocaleString()}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${(item.quantity / maxQuantity) * 100}%`, height: '100%', background: 'var(--primary)', borderRadius: 3, transition: 'width .3s ease' }} />
                        </div>
                        <span style={{ fontSize: '.72rem', color: 'var(--text-muted)', width: 32, textAlign: 'right', flexShrink: 0 }}>
                          {totalUnits > 0 ? `${Math.round((item.quantity / totalUnits) * 100)}%` : '0%'}
                        </span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--primary)' }}>{item.revenue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashLayout>
  )
}
