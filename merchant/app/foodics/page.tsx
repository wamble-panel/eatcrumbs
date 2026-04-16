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
  status: 'success' | 'failed' | 'running'
  items_synced: number | null
  error: string | null
  started_at: string
  finished_at: string | null
  created_at: string
}

function fmt(date: string | null | undefined) {
  if (!date) return 'Never synced'
  return new Date(date).toLocaleDateString('en-US', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function StatusTag({ status }: { status: string }) {
  if (status === 'success') return (
    <span style={{ background: '#dcfce7', color: '#15803d', borderRadius: 99, padding: '2px 10px', fontSize: '.72rem', fontWeight: 700 }}>Success</span>
  )
  if (status === 'running') return (
    <span style={{ background: '#dbeafe', color: '#1d4ed8', borderRadius: 99, padding: '2px 10px', fontSize: '.72rem', fontWeight: 700 }}>Running…</span>
  )
  return (
    <span style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 99, padding: '2px 10px', fontSize: '.72rem', fontWeight: 700 }}>Failed</span>
  )
}

function SyncRow({ label, date, status, isLoading }: { label: string; date: string | null; status?: string; isLoading?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <span style={{ fontSize: '.8rem', color: 'var(--text-muted)', minWidth: 130 }}>{label}:</span>
      <span style={{ fontSize: '.8rem', color: 'var(--text)', fontWeight: 500 }}>{fmt(date)}</span>
      {isLoading && <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
      {!isLoading && status && date && <StatusTag status={status} />}
    </div>
  )
}

export default function FoodicsPage() {
  const [status, setStatus]       = useState<FoodicsStatus | null>(null)
  const [authUrl, setAuthUrl]     = useState<string | null>(null)
  const [history, setHistory]     = useState<SyncLog[]>([])
  const [loading, setLoading]     = useState(true)
  const [syncing, setSyncing]     = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    adminGet<{ url: string }>('/foodics/auth-url').then(r => setAuthUrl(r.url)).catch(() => {})
    try {
      const [s, h] = await Promise.all([
        adminGet<FoodicsStatus>('/foodics/status'),
        adminGet<{ history: SyncLog[] }>('/foodics/sync-history'),
      ])
      setStatus(s)
      setHistory(h.history)
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  async function doSync(label: string) {
    setSyncing(label)
    setError(null)
    try {
      await adminPost<{ success: boolean; itemsSynced: number }>('/foodics/sync')
      const h = await adminGet<{ history: SyncLog[] }>('/foodics/sync-history')
      setHistory(h.history)
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setSyncing(null) }
  }

  async function doDisconnect() {
    if (!confirm('Disconnect Foodics integration?')) return
    setDisconnecting(true)
    try {
      await adminPost('/foodics/disconnect')
      setStatus(s => s ? { ...s, connected: false } : s)
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setDisconnecting(false) }
  }

  const lastSync  = history[0] ?? null
  const lastOk    = history.find(h => h.status === 'success') ?? null

  const WARNING = (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#fef3c7', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <span style={{ fontSize: '.8rem', color: '#92400e', lineHeight: 1.5 }}>
        Sync takes around 5–10 minutes. Please be patient and wait for completion, then refresh afterward.
      </span>
    </div>
  )

  return (
    <DashLayout pageTitle="Foodics">
      <div style={{ padding: '24px 24px 40px', maxWidth: 700 }}>
        <h1 className="main-title" style={{ marginBottom: 24 }}>Foodics</h1>

        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '.875rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>✕</button>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
        ) : (
          <>
            {/* ── Connection card ───────────────────────────────── */}
            <div className="card" style={{ padding: 24, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: '#fff', fontWeight: 800, fontSize: '.8rem' }}>FDS</span>
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>Foodics POS</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: status?.connected ? '#22c55e' : '#ef4444', display: 'inline-block' }} />
                      <span style={{ fontSize: '.83rem', color: 'var(--text-muted)' }}>
                        {status?.connected
                          ? `Connected${status.updatedAt ? ` · Updated ${new Date(status.updatedAt).toLocaleDateString()}` : ''}`
                          : 'Not connected'}
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
                    Connect to Foodics
                  </a>
                ) : (
                  <button className="btn btn-primary" disabled style={{ fontSize: '.875rem' }}>Connect to Foodics</button>
                )}
              </div>
            </div>

            {/* ── Sync sections (only when connected) ──────────── */}
            {status?.connected ? (
              <div className="card" style={{ padding: 28 }}>

                {/* ── Menu Sync ── */}
                <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>Menu Sync:</p>
                <p style={{ fontSize: '.875rem', color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
                  Syncs all products, modifiers and combos
                </p>
                <div style={{ marginBottom: 16 }}>
                  <SyncRow label="Last Menu Sync" date={lastSync?.started_at ?? null} status={lastSync?.status} isLoading={syncing !== null} />
                  {lastOk && <SyncRow label="Last Successful Sync" date={lastOk.started_at} />}
                </div>
                {WARNING}
                <button
                  className="btn btn-primary"
                  style={{ minWidth: 140, marginBottom: 28 }}
                  disabled={syncing !== null}
                  onClick={() => doSync('menu')}
                >
                  {syncing === 'menu'
                    ? <><span className="spinner" style={{ borderTopColor: '#fff' }} /> Syncing…</>
                    : 'Sync Menu'}
                </button>

                <hr style={{ border: 'none', borderTop: '1px solid var(--border)', marginBottom: 28 }} />

                {/* ── Settings Sync ── */}
                <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>Settings Sync:</p>
                <p style={{ fontSize: '.875rem', color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
                  Syncs all branches, restaurant images and configurations
                </p>
                <div style={{ marginBottom: 16 }}>
                  <SyncRow label="Last Settings Sync" date={lastSync?.started_at ?? null} status={lastSync?.status} isLoading={syncing !== null} />
                  {lastOk && <SyncRow label="Last Successful Sync" date={lastOk.started_at} />}
                </div>
                <button
                  className="btn btn-primary"
                  style={{ minWidth: 160, marginBottom: 28 }}
                  disabled={syncing !== null}
                  onClick={() => doSync('settings')}
                >
                  {syncing === 'settings'
                    ? <><span className="spinner" style={{ borderTopColor: '#fff' }} /> Syncing…</>
                    : 'Sync Settings'}
                </button>

                <hr style={{ border: 'none', borderTop: '1px solid var(--border)', marginBottom: 28 }} />

                {/* ── Settings and Menu Sync (Sync All) ── */}
                <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>Settings and Menu Sync:</p>
                <p style={{ fontSize: '.875rem', color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
                  Syncs both menu and settings. (Be careful while using)
                </p>
                <button
                  className="btn btn-primary"
                  style={{ minWidth: 120 }}
                  disabled={syncing !== null}
                  onClick={() => doSync('all')}
                >
                  {syncing === 'all'
                    ? <><span className="spinner" style={{ borderTopColor: '#fff' }} /> Syncing…</>
                    : 'Sync All'}
                </button>
              </div>
            ) : (
              <div className="card" style={{ padding: '64px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 16px', display: 'block', opacity: 0.3 }}>
                  <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: 8, color: 'var(--text)' }}>Connect with Foodics</p>
                <p style={{ fontSize: '.875rem', marginBottom: 24 }}>
                  Connect your restaurant to Foodics to synchronize your menu and orders.
                </p>
                {authUrl && (
                  <a href={authUrl} className="btn btn-primary" style={{ textDecoration: 'none' }}>Connect to Foodics</a>
                )}
              </div>
            )}

            {/* ── Sync history ─────────────────────────────────── */}
            {status?.connected && history.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <p style={{ fontWeight: 700, fontSize: '.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>
                  Sync History
                </p>
                <div className="card" style={{ padding: '0 0 4px' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Items</th>
                        <th>Started</th>
                        <th>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(log => {
                        const dur = log.finished_at
                          ? Math.round((new Date(log.finished_at).getTime() - new Date(log.started_at).getTime()) / 1000)
                          : null
                        return (
                          <tr key={log.id}>
                            <td><StatusTag status={log.status} /></td>
                            <td style={{ textAlign: 'right' }}>{log.items_synced ?? '—'}</td>
                            <td style={{ color: 'var(--text-muted)', fontSize: '.82rem', whiteSpace: 'nowrap' }}>
                              {new Date(log.started_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>
                              {dur !== null ? `${dur}s` : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashLayout>
  )
}
