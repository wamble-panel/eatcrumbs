'use client'

import { useState, useEffect } from 'react'
import DashLayout from '../../components/DashLayout'
import { adminGet, adminPost } from '../../lib/api'

interface Notification {
  id: number
  title: string
  body: string | null
  sent_count: number
  created_at: string
}

export default function NotificationsPage() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<Notification[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  useEffect(() => {
    adminGet<{ notifications: Notification[]; total: number }>('/notifications/list?page=1&pageSize=20')
      .then(({ notifications }) => setHistory(notifications))
      .catch(() => {})
      .finally(() => setLoadingHistory(false))
  }, [])

  async function send() {
    if (!title.trim()) return
    setSending(true)
    setError(null)
    setSent(null)
    try {
      const res = await adminPost<{ sent: number }>('/notifications/send', {
        title: title.trim(),
        body: body.trim() || undefined,
      })
      setSent(res.sent)
      // Add to history optimistically
      setHistory(prev => [{
        id: Date.now(),
        title: title.trim(),
        body: body.trim() || null,
        sent_count: res.sent,
        created_at: new Date().toISOString(),
      }, ...prev])
      setTitle('')
      setBody('')
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setSending(false) }
  }

  return (
    <DashLayout pageTitle="Notifications">
      <div style={{ padding: '24px 24px 40px' }}>
        <h1 style={{ fontWeight: 800, fontSize: '1.4rem', marginBottom: 24 }}>Notifications</h1>

        {/* Compose */}
        <div className="card" style={{ padding: 24, maxWidth: 560, marginBottom: 32 }}>
          <p style={{ fontWeight: 700, fontSize: '.9rem', marginBottom: 16 }}>Send Push Notification</p>

          {error && (
            <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: '.8rem' }}>
              {error}
            </div>
          )}
          {sent !== null && (
            <div style={{ background: '#dcfce7', color: '#15803d', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: '.8rem' }}>
              ✓ Sent to {sent} customer{sent !== 1 ? 's' : ''}
            </div>
          )}

          <div className="field">
            <label>Title <span style={{ color: '#ef4444' }}>*</span></label>
            <input className="input" placeholder="e.g. Special offer this weekend!" value={title} onChange={e => setTitle(e.target.value)} maxLength={100} />
            <span style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginTop: 3 }}>{title.length}/100</span>
          </div>
          <div className="field" style={{ marginBottom: 20 }}>
            <label>Message <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
            <textarea
              className="input"
              placeholder="Add more detail about your notification…"
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={3}
              maxLength={300}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
            <span style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginTop: 3 }}>{body.length}/300</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-primary" disabled={sending || !title.trim()} onClick={send} style={{ minWidth: 140 }}>
              {sending ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                  Send to all customers
                </>
              )}
            </button>
            <span style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>Will be sent to all customers with push notifications enabled</span>
          </div>
        </div>

        {/* History */}
        <div>
          <p style={{ fontWeight: 700, fontSize: '.78rem', marginBottom: 14, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Sent History</p>
          {loadingHistory ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>
          ) : history.length === 0 ? (
            <div className="card" style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '.875rem' }}>
              No notifications sent yet.
            </div>
          ) : (
            <div className="card" style={{ padding: '0 0 4px' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Message</th>
                    <th style={{ textAlign: 'right' }}>Recipients</th>
                    <th>Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(n => (
                    <tr key={n.id}>
                      <td style={{ fontWeight: 600 }}>{n.title}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '.82rem', maxWidth: 240 }}>
                        <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {n.body ?? <em>No message</em>}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{n.sent_count}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '.82rem', whiteSpace: 'nowrap' }}>
                        {new Date(n.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashLayout>
  )
}
