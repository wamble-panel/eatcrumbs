'use client'

import { useState, useEffect, useCallback } from 'react'
import DashLayout from '../../components/DashLayout'
import { adminGet, adminPost } from '../../lib/api'

interface FeedbackItem {
  id: number
  franchise_id: number
  customer_id?: string | null
  rating: number
  comment?: string | null
  is_read: boolean
  created_at: string
  customer?: { name?: string; phone?: string } | null
}

interface FeedbackStats {
  total: number
  unread: number
  averageRating: number
  distribution: Record<string, number>
}

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24"
          fill={i <= rating ? '#f59e0b' : 'none'} stroke="#f59e0b" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ))}
    </span>
  )
}

export default function FeedbackPage() {
  const [tab, setTab] = useState<'reviews' | 'analytics'>('reviews')
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [stats, setStats] = useState<FeedbackStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [ratingFilter, setRatingFilter] = useState<number | ''>('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const PAGE_SIZE = 15

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [feedbackRes, statsRes, pagesRes] = await Promise.all([
        adminPost<{ feedback: FeedbackItem[]; total: number }>('/feedback', {
          rating: ratingFilter || undefined,
          isRead: unreadOnly ? false : undefined,
          page,
          pageSize: PAGE_SIZE,
        }),
        adminPost<FeedbackStats>('/feedback/overall', {}),
        adminPost<{ total: number; pages: number }>('/feedback/pagination', {
          rating: ratingFilter || undefined,
          isRead: unreadOnly ? false : undefined,
          pageSize: PAGE_SIZE,
        }),
      ])
      setItems(feedbackRes.feedback)
      setStats(statsRes)
      setTotalPages(pagesRes.pages)
    } catch { /* silently fail */ }
    finally { setLoading(false) }
  }, [page, ratingFilter, unreadOnly])

  useEffect(() => { load() }, [load])

  async function markRead(ids: number[]) {
    try {
      await adminPost('/feedback/mark-read', { feedbackIds: ids })
      setItems(prev => prev.map(f => ids.includes(f.id) ? { ...f, is_read: true } : f))
      if (stats) setStats(s => s ? { ...s, unread: Math.max(0, s.unread - ids.length) } : s)
    } catch { /* ignore */ }
  }

  const unreadIds = items.filter(f => !f.is_read).map(f => f.id)
  const ratingDist = stats ? [5,4,3,2,1].map(n => ({ n, count: stats.distribution[String(n)] ?? 0 })) : []
  const maxDist = Math.max(...ratingDist.map(r => r.count), 1)

  return (
    <DashLayout pageTitle="Feedback">
      <div style={{ padding: '24px 24px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <h1 style={{ fontWeight: 800, fontSize: '1.4rem' }}>Feedback</h1>
          {unreadIds.length > 0 && (
            <button className="btn btn-ghost" style={{ fontSize: '.8rem' }} onClick={() => markRead(unreadIds)}>
              Mark all as read ({unreadIds.length})
            </button>
          )}
        </div>

        {/* Stats row */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Total Reviews', value: stats.total },
              { label: 'Unread', value: stats.unread, color: stats.unread > 0 ? '#f59e0b' : undefined },
              { label: 'Avg Rating', value: stats.averageRating.toFixed(1), color: '#f59e0b' },
              { label: '5 Stars', value: stats.distribution['5'] ?? 0, color: '#22c55e' },
              { label: '1 Star', value: stats.distribution['1'] ?? 0, color: '#ef4444' },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: '16px 18px' }}>
                <p style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{s.label}</p>
                <p style={{ fontWeight: 800, fontSize: '1.5rem', color: s.color ?? 'var(--text)' }}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
          {(['reviews', 'analytics'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 16px', fontSize: '.875rem',
              fontWeight: tab === t ? 700 : 500,
              color: tab === t ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: `2px solid ${tab === t ? 'var(--primary)' : 'transparent'}`,
              marginBottom: -2, transition: 'all .15s', textTransform: 'capitalize',
            }}>{t}</button>
          ))}
        </div>

        {tab === 'reviews' && (
          <>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <select className="input" style={{ width: 160 }} value={ratingFilter} onChange={e => { setRatingFilter(e.target.value ? Number(e.target.value) : ''); setPage(1) }}>
                <option value="">All ratings</option>
                {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} star{n !== 1 ? 's' : ''}</option>)}
              </select>
              <button
                className={`btn ${unreadOnly ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: '.8rem' }}
                onClick={() => { setUnreadOnly(v => !v); setPage(1) }}
              >
                Unread only {stats && stats.unread > 0 && <span style={{ background: 'rgba(255,255,255,.25)', borderRadius: 99, padding: '1px 6px', marginLeft: 4, fontSize: '.72rem' }}>{stats.unread}</span>}
              </button>
            </div>

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
            ) : items.length === 0 ? (
              <div className="card" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <p>No reviews found for the selected filters.</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {items.map(f => (
                    <div key={f.id} className="card" style={{
                      padding: '16px 20px',
                      borderLeft: `3px solid ${f.is_read ? 'transparent' : '#f59e0b'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                            <Stars rating={f.rating} />
                            {!f.is_read && (
                              <span style={{ fontSize: '.7rem', background: '#fef3c7', color: '#b45309', borderRadius: 99, padding: '2px 8px', fontWeight: 700 }}>New</span>
                            )}
                            <span style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>
                              {new Date(f.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                            {f.customer?.name && (
                              <span style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>· {f.customer.name}</span>
                            )}
                            {f.customer?.phone && (
                              <span style={{ fontSize: '.78rem', color: 'var(--text-muted)', direction: 'ltr' }}>{f.customer.phone}</span>
                            )}
                          </div>
                          {f.comment ? (
                            <p style={{ fontSize: '.875rem', color: 'var(--text)', lineHeight: 1.5 }}>{f.comment}</p>
                          ) : (
                            <p style={{ fontSize: '.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No written comment</p>
                          )}
                        </div>
                        {!f.is_read && (
                          <button className="btn btn-ghost" style={{ fontSize: '.75rem', padding: '.25rem .6rem', flexShrink: 0 }} onClick={() => markRead([f.id])}>
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 }}>
                    <button className="btn btn-ghost" style={{ fontSize: '.8rem' }} disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                    <span style={{ fontSize: '.875rem', color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
                    <button className="btn btn-ghost" style={{ fontSize: '.8rem' }} disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === 'analytics' && stats && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card" style={{ padding: 20 }}>
              <p style={{ fontWeight: 700, marginBottom: 16, fontSize: '.9rem' }}>Rating Distribution</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120, marginBottom: 12 }}>
                {[1,2,3,4,5].map(n => {
                  const count = stats.distribution[String(n)] ?? 0
                  const h = maxDist > 0 ? (count / maxDist) * 100 : 0
                  return (
                    <div key={n} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>{count}</span>
                      <div style={{ width: '100%', height: `${h}%`, minHeight: count > 0 ? 4 : 0, background: n >= 4 ? '#22c55e' : n === 3 ? '#f59e0b' : '#ef4444', borderRadius: '4px 4px 0 0', transition: 'height .4s ease' }} />
                      <span style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>{n}★</span>
                    </div>
                  )
                })}
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 800, fontSize: '1.4rem', color: '#f59e0b' }}>{stats.averageRating.toFixed(1)}</span>
                <Stars rating={stats.averageRating} size={16} />
                <span style={{ fontSize: '.82rem', color: 'var(--text-muted)' }}>from {stats.total} reviews</span>
              </div>
            </div>

            <div className="card" style={{ padding: 20 }}>
              <p style={{ fontWeight: 700, marginBottom: 16, fontSize: '.9rem' }}>Breakdown</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {ratingDist.map(({ n, count }) => (
                  <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.82rem' }}>
                    <span style={{ width: 14, textAlign: 'right', color: 'var(--text-muted)', flexShrink: 0 }}>{n}</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="#f59e0b" style={{ flexShrink: 0 }}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${(count / maxDist) * 100}%`, height: '100%', background: n >= 4 ? '#22c55e' : n === 3 ? '#f59e0b' : '#ef4444', borderRadius: 4, transition: 'width .4s ease' }} />
                    </div>
                    <span style={{ width: 30, textAlign: 'right', color: 'var(--text-muted)', flexShrink: 0 }}>{count}</span>
                    <span style={{ width: 36, textAlign: 'right', color: 'var(--text-muted)', flexShrink: 0, fontSize: '.72rem' }}>
                      {stats.total > 0 ? `${Math.round((count / stats.total) * 100)}%` : '0%'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashLayout>
  )
}
