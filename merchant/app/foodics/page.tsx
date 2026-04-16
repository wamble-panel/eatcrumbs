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
}

function StatusTag({ status }: { status: string }) {
  const MAP: Record<string, { bg: string; color: string; label: string }> = {
    success: { bg: '#dcfce7', color: '#15803d', label: 'Success' },
    failed:  { bg: '#fee2e2', color: '#b91c1c', label: 'Failed' },
    error:   { bg: '#fee2e2', color: '#b91c1c', label: 'Failed' },
    running: { bg: '#dbeafe', color: '#1d4ed8', label: 'Running' },
  }
  const s = MAP[status] ?? { bg: '#f1f5f9', color: '#475569', label: status }
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 99, padding: '2px 10px', fontSize: '.72rem', fontWeight: 700 }}>
      {s.label}
    </span>
  )
}

function fmt(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const SYNC_SECTIONS = [
  {
    key: 'menu',
    title: 'Menu Sync',
    description: 'Pulls all products, categories and modifiers from Foodics into your menu.',
    warning: 'Menu sync may take 5–10 minutes depending on your catalogue size. Do not close this page.',
    btnLabel: 'Sync Menu',
  },
  {
    key: 'settings',
    title: 'Settings Sync',
    description: 'Syncs branch settings, operating hours and payment methods from Foodics.',
    warning: 'Settings sync updates your branch configuration. Changes take effect immediately.',
    btnLabel: 'Sync Settings',
  },
  {
    key: 'all',
    title: 'Settings and Menu Sync',
    description: 'Performs a full sync — menu, settings and all configurations in one go.',
    warning: 'Full sync can take 10–15 minutes. Keep this page open until complete.',
    btnLabel: 'Sync All',
  },
]

export default function FoodicsPage() {
  const [status, setStatus]       = useState<FoodicsStatus | null>(null)
  const [authUrl, setAuthUrl]     = useState<string | null>(null)
  const [history, setHistory]     = useState<SyncLog[]>([])
  const [loading, setLoading]     = useState(true)
  const [syncing, setSyncing]     = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    // Always pre-fetch auth URL so the Connect button is available if needed
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

  async function doSync(key: string) {
    setSyncing(key)
    setSyncResult(null)
    setError(null)
    try {
      const res = await adminPost<{ success: boolean; itemsSynced: number }>('/foodics/sync')
      setSyncResult(`Sync complete — ${res.itemsSynced} item${res.itemsSynced !== 1 ? 's' : ''} synced`)
      const h = await adminGet<{ history: SyncLog[] }>('/foodics/sync-history')
      setHistory(h.history)
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setSyncing(null) }
  }

  async function doDisconnect() {
    if (!confirm('Disconnect Foodics integration? This will stop all syncs.')) return
    setDisconnecting(true)
    try {
      await adminPost('/foodics/disconnect')
      setStatus(s => s ? { ...s, connected: false } : s)
      adminGet<{ url: string }>('/foodics/auth-url').then(r => setAuthUrl(r.url)).catch(() => {})
      setHistory([])
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setDisconnecting(false) }
  }

  // Last successful / any sync info
  const lastSync = history[0] ?? null

  return (
    <DashLayout pageTitle="Foodics">
      <div style={{ padding: '24px 24px 40px' }}>

        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '.875rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', color: '#b91c1c' }}>✕</button>
          </div>
        )}

        {syncResult && (
          <div style={{ background: '#dcfce7', color: '#15803d', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '.875rem' }}>
            ✓ {syncResult}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>
        ) : (
          <>
            {/* ── Connection card ─────────────────────────────────────── */}
            <div className="card" style={{ padding: 24, marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 14, background: '#0a0a1a',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    boxShadow: 'var(--shadow)',
                  }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                    </svg>
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 4 }}>Foodics POS</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: status?.connected ? '#22c55e' : '#ef4444',
                        display: 'inline-block', flexShrink: 0,
                      }} />
                      <span style={{ fontSize: '.83rem', color: 'var(--text-muted)' }}>
                        {status?.connected
                          ? `Connected${status.updatedAt ? ` · Connected ${fmt(status.updatedAt)}` : ''}`
                          : 'Not connected'}
                      </span>
                    </div>
                  </div>
                </div>

                {status?.connected ? (
                  <button
                    className="btn btn-ghost"
                    style={{ color: '#ef4444', fontSize: '.83rem', minHeight: 38 }}
                    disabled={disconnecting}
                    onClick={doDisconnect}
                  >
                    {disconnecting ? <span className="spinner" /> : 'Disconnect'}
                  </button>
                ) : authUrl ? (
                  <a href={authUrl} className="btn btn-primary" style={{ textDecoration: 'none', fontSize: '.875rem' }}>
                    Connect Foodics
                  </a>
                ) : null}
              </div>
            </div>

            {status?.connected ? (
              <>
                {/* ── Sync sections ───────────────────────────────────── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginBottom: 28 }}>
                  {SYNC_SECTIONS.map(({ key, title, description, warning, btnLabel }) => (
                    <div key={key} className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column' }}>
                      <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>{title}</p>

                      {/* Last sync info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <span style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>
                          Last sync: {lastSync ? fmt(lastSync.started_at) : 'Never'}
                        </span>
                        {lastSync && <StatusTag status={lastSync.status} />}
                      </div>

                      <p style={{ fontSize: '.83rem', color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.55, flex: 1 }}>
                        {description}
                      </p>

                      <div style={{
                        background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
                        padding: '8px 12px', marginBottom: 16, fontSize: '.78rem', color: '#92400e',
                        display: 'flex', gap: 6,
                      }}>
                        <span style={{ flexShrink: 0 }}>⚠</span>
                        <span>{warning}</span>
                      </div>

                      <button
                        className="btn btn-primary"
                        style={{ fontSize: '.875rem', width: '100%' }}
                        disabled={syncing !== null}
                        onClick={() => doSync(key)}
                      >
                        {syncing === key ? (
                          <><span className="spinner" style={{ borderTopColor: '#fff' }} />&nbsp; Syncing…</>
                        ) : btnLabel}
                      </button>
                    </div>
                  ))}
                </div>

                {/* ── Sync history ────────────────────────────────────── */}
                <p style={{ fontWeight: 700, fontSize: '.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>
                  Sync History
                </p>

                {history.length === 0 ? (
                  <div className="card" style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '.875rem' }}>
                    No sync history yet.
                  </div>
                ) : (
                  <div className="card" style={{ padding: '0 0 4px' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Items synced</th>
                          <th>Started</th>
                          <th>Duration</th>
                          <th>Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map(log => {
                          const duration = log.finished_at
                            ? Math.round((new Date(log.finished_at).getTime() - new Date(log.started_at).getTime()) / 1000)
                            : null
                          return (
                            <tr key={log.id}>
                              <td><StatusTag status={log.status} /></td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>{log.items_synced ?? '—'}</td>
                              <td style={{ color: 'var(--text-muted)', fontSize: '.82rem', whiteSpace: 'nowrap' }}>
                                {fmt(log.started_at)}
                              </td>
                              <td style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>
                                {duration !== null ? `${duration}s` : '—'}
                              </td>
                              <td style={{ fontSize: '.78rem', color: '#b91c1c', maxWidth: 200 }}>
                                {log.error ?? '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              /* ── Not connected empty state ──────────────────────────── */
              <div className="card" style={{ padding: '64px 24px', textAlign: 'center' }}>
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="var(--border)" strokeWidth="1.5" style={{ margin: '0 auto 20px', display: 'block' }}>
                  <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                <p style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 8, color: 'var(--text)' }}>Foodics not connected</p>
                <p style={{ fontSize: '.875rem', color: 'var(--text-muted)', marginBottom: 24, maxWidth: 360, margin: '0 auto 24px' }}>
                  Connect your Foodics account to sync your menu, settings and keep everything in sync automatically.
                </p>
                {authUrl && (
                  <a href={authUrl} className="btn btn-primary" style={{ textDecoration: 'none' }}>
                    Connect Foodics
                  </a>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </DashLayout>
  )
}
