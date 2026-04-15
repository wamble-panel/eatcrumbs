'use client'

import { useState, useEffect } from 'react'
import DashLayout from '../../components/DashLayout'
import { adminGet, adminPost } from '../../lib/api'

interface FoodicsStatus {
  connected: boolean
  expiresAt: string | null
  updatedAt: string | null
}

interface SyncLog {
  id: number
  sync_type: 'menu' | 'settings' | 'all'
  status: 'success' | 'failed' | 'running'
  items_synced: number | null
  error_message: string | null
  started_at: string
  finished_at: string | null
}

function StatusTag({ status }: { status: 'success' | 'failed' | 'running' }) {
  const MAP = {
    success: { bg: '#dcfce7', color: '#15803d', label: 'Success' },
    failed:  { bg: '#fee2e2', color: '#b91c1c', label: 'Failed' },
    running: { bg: '#dbeafe', color: '#1d4ed8', label: 'Running' },
  }
  const s = MAP[status]
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 99, padding: '2px 10px', fontSize: '.72rem', fontWeight: 700 }}>
      {s.label}
    </span>
  )
}

export default function FoodicsPage() {
  const [status, setStatus] = useState<FoodicsStatus | null>(null)
  const [authUrl, setAuthUrl] = useState<string | null>(null)
  const [history, setHistory] = useState<SyncLog[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<'menu' | 'all' | null>(null)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [s, h] = await Promise.all([
        adminGet<FoodicsStatus>('/foodics/status'),
        adminGet<{ history: SyncLog[] }>('/foodics/sync-history'),
      ])
      setStatus(s)
      setHistory(h.history)
      if (!s.connected) {
        adminGet<{ url: string }>('/foodics/auth-url').then(r => setAuthUrl(r.url)).catch(() => {})
      }
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  async function doSync(type: 'menu' | 'all') {
    setSyncing(type)
    setSyncResult(null)
    setError(null)
    try {
      const res = await adminPost<{ success: boolean; itemsSynced: number }>('/foodics/sync')
      setSyncResult(`Sync complete — ${res.itemsSynced} items synced`)
      await adminGet<{ history: SyncLog[] }>('/foodics/sync-history').then(r => setHistory(r.history)).catch(() => {})
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setSyncing(null) }
  }

  async function doDisconnect() {
    if (!confirm('Disconnect Foodics integration?')) return
    setDisconnecting(true)
    try {
      await adminPost('/foodics/disconnect')
      setStatus(s => s ? { ...s, connected: false } : s)
      adminGet<{ url: string }>('/foodics/auth-url').then(r => setAuthUrl(r.url)).catch(() => {})
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setDisconnecting(false) }
  }

  return (
    <DashLayout pageTitle="Foodics">
      <div style={{ padding: '24px 24px 40px' }}>
        <h1 style={{ fontWeight: 800, fontSize: '1.4rem', marginBottom: 24 }}>Foodics Integration</h1>

        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '.875rem' }}>
            {error}
            <button onClick={() => setError(null)} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>✕</button>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
        ) : (
          <>
            {/* Connection status */}
            <div className="card" style={{ padding: 24, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {/* Foodics logo placeholder */}
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: '#fff', fontWeight: 800, fontSize: '.8rem', letterSpacing: '-.5px' }}>FDS</span>
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>Foodics POS</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: status?.connected ? '#22c55e' : '#ef4444', display: 'inline-block' }} />
                      <span style={{ fontSize: '.83rem', color: 'var(--text-muted)' }}>
                        {status?.connected ? 'Connected' : 'Not connected'}
                        {status?.connected && status.updatedAt && ` · Last updated ${new Date(status.updatedAt).toLocaleDateString()}`}
                      </span>
                    </div>
                  </div>
                </div>
                {status?.connected ? (
                  <button className="btn btn-ghost" style={{ color: '#ef4444', fontSize: '.8rem' }} disabled={disconnecting} onClick={doDisconnect}>
                    {disconnecting ? <span className="spinner" /> : 'Disconnect'}
                  </button>
                ) : authUrl ? (
                  <a href={authUrl} className="btn btn-primary" style={{ textDecoration: 'none', fontSize: '.875rem' }}>
                    Connect Foodics
                  </a>
                ) : null}
              </div>
            </div>

            {status?.connected && (
              <>
                {syncResult && (
                  <div style={{ background: '#dcfce7', color: '#15803d', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '.875rem' }}>
                    ✓ {syncResult}
                  </div>
                )}

                {/* Sync actions */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginBottom: 24 }}>
                  {[
                    {
                      key: 'menu' as const,
                      title: 'Menu Sync',
                      description: 'Syncs all products, modifiers and combos from Foodics into your menu.',
                      warning: 'Sync takes around 5–10 minutes. Please be patient.',
                    },
                    {
                      key: 'all' as const,
                      title: 'Full Sync',
                      description: 'Syncs both menu and settings. Use this when doing a complete refresh.',
                      warning: 'This may take longer. Do not close the page.',
                    },
                  ].map(({ key, title, description, warning }) => (
                    <div key={key} className="card" style={{ padding: 20 }}>
                      <p style={{ fontWeight: 700, marginBottom: 6 }}>{title}</p>
                      <p style={{ fontSize: '.83rem', color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>{description}</p>
                      <div style={{ background: '#fef3c7', borderRadius: 8, padding: '8px 12px', marginBottom: 16, fontSize: '.78rem', color: '#92400e' }}>
                        ⚠ {warning}
                      </div>
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: '.8rem', width: '100%' }}
                        disabled={syncing !== null}
                        onClick={() => doSync(key)}
                      >
                        {syncing === key ? (
                          <><span className="spinner" style={{ borderTopColor: '#fff', marginRight: 6 }} /> Syncing…</>
                        ) : `Sync ${key === 'menu' ? 'Menu' : 'All'}`}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Sync history */}
                <div>
                  <p style={{ fontWeight: 700, fontSize: '.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>Sync History</p>
                  {history.length === 0 ? (
                    <div className="card" style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '.875rem' }}>
                      No sync history yet.
                    </div>
                  ) : (
                    <div className="card" style={{ padding: '0 0 4px' }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'right' }}>Items synced</th>
                            <th>Started</th>
                            <th>Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map(log => {
                            const duration = log.finished_at
                              ? Math.round((new Date(log.finished_at).getTime() - new Date(log.started_at).getTime()) / 1000)
                              : null
                            return (
                              <tr key={log.id}>
                                <td style={{ textTransform: 'capitalize', fontWeight: 600 }}>{log.sync_type}</td>
                                <td><StatusTag status={log.status} /></td>
                                <td style={{ textAlign: 'right' }}>{log.items_synced ?? '—'}</td>
                                <td style={{ color: 'var(--text-muted)', fontSize: '.82rem', whiteSpace: 'nowrap' }}>
                                  {new Date(log.started_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>
                                  {duration !== null ? `${duration}s` : '—'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {!status?.connected && (
              <div className="card" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 16px', display: 'block', opacity: 0.3 }}>
                  <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                <p style={{ fontWeight: 600, marginBottom: 8 }}>Foodics is not connected</p>
                <p style={{ fontSize: '.875rem', marginBottom: 20 }}>Connect your Foodics account to sync your menu and settings.</p>
                {authUrl && <a href={authUrl} className="btn btn-primary" style={{ textDecoration: 'none' }}>Connect Foodics</a>}
              </div>
            )}
          </>
        )}
      </div>
    </DashLayout>
  )
}
