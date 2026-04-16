'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
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
  if (!date) return '-'
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
      <span style={{ fontSize: '.8rem', color: 'var(--text-muted)', minWidth: 210 }}>{label}:</span>
      <span style={{ fontSize: '.8rem', color: 'var(--text)', fontWeight: 500 }}>{fmt(date)}</span>
      {isLoading && <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
      {!isLoading && status && date && <StatusTag status={status} />}
    </div>
  )
}

const FoodicsLogo = ({ size = 48 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 50 50">
    <circle fill="#2E2D2C" cx="25" cy="25" r="25"/>
    <g transform="translate(13,12)" fill="#FFFFFF">
      <path d="M5.486,21.033C5.265,20.819 5.006,20.649 4.721,20.533C4.416,20.410 4.089,20.349 3.760,20.352L2.426,20.352C2.096,20.349 1.769,20.411 1.462,20.533C0.880,20.764 0.418,21.225 0.186,21.807C0.061,22.114-0.002,22.443 0.000,22.775L0.000,23.812C-0.004,24.144 0.059,24.474 0.186,24.782C0.304,25.069 0.477,25.331 0.694,25.553C0.913,25.770 1.175,25.940 1.462,26.053C1.768,26.172 2.094,26.233 2.422,26.232L3.756,26.232C4.085,26.234 4.411,26.173 4.717,26.053C5.004,25.938 5.265,25.768 5.486,25.553C5.704,25.331 5.876,25.069 5.994,24.782C6.118,24.473 6.180,24.144 6.176,23.812L6.176,22.775C6.179,22.445 6.118,22.117 5.994,21.811C5.879,21.521 5.706,21.258 5.486,21.037"/>
      <path d="M6.005,7.631C6.004,6.703 6.756,5.949 7.685,5.949L7.689,5.949L23.868,5.949L23.868,0L7.829,0C3.539,0.001 0.062,3.480 0.063,7.771L0.063,10.351C0.061,14.641 3.537,18.122 7.828,18.124L7.829,18.124L16.283,18.124L16.283,12.177L7.689,12.177C6.761,12.178 6.007,11.427 6.005,10.499L6.005,10.493L6.005,7.631Z"/>
    </g>
  </svg>
)

function FoodicsContent() {
  const searchParams = useSearchParams()
  const [status, setStatus]             = useState<FoodicsStatus | null>(null)
  const [authUrl, setAuthUrl]           = useState<string | null>(null)
  const [history, setHistory]           = useState<SyncLog[]>([])
  const [loading, setLoading]           = useState(true)
  const [syncing, setSyncing]           = useState<string | null>(null)
  const [error, setError]               = useState<string | null>(null)
  const [justConnected, setJustConnected] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    if (searchParams.get('connected') === 'true') setJustConnected(true)
    loadAll()
  }, []) // eslint-disable-line

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

  async function doSync(type: string) {
    setSyncing(type)
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

  const lastSync = history[0] ?? null
  const lastOk   = history.find(h => h.status === 'success') ?? null

  return (
    <div style={{ padding: '24px 24px 40px', maxWidth: 700 }}>
      <h1 className="main-title" style={{ marginBottom: 24 }}>Foodics</h1>

      {justConnected && (
        <div style={{ background: '#dcfce7', color: '#15803d', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '.875rem', display: 'flex', justifyContent: 'space-between' }}>
          <span>Successfully connected to Foodics!</span>
          <button onClick={() => setJustConnected(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>✕</button>
        </div>
      )}

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
          {/* ── Connection card ─────────────────────────────────── */}
          <div className="card" style={{ padding: 24, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ flexShrink: 0 }}>
                  <FoodicsLogo size={48} />
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

          {/* ── Sync sections (only when connected) ─────────────── */}
          {status?.connected ? (
            <div className="card" style={{ padding: 28 }}>

              {/* ── Menu Sync ── */}
              <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>Menu Sync:</p>
              <p style={{ fontSize: '.875rem', color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
                Syncs all products, modifiers and combos
              </p>
              <div style={{ marginBottom: 16 }}>
                <SyncRow label="Last Menu Sync" date={lastSync?.started_at ?? null} status={lastSync?.status} isLoading={syncing !== null} />
                <SyncRow label="Last Successful Menu Sync" date={lastOk?.started_at ?? null} />
              </div>
              <button
                className="btn btn-primary"
                style={{ minWidth: 140 }}
                disabled={syncing !== null}
                onClick={() => doSync('menu')}
              >
                {syncing === 'menu'
                  ? <><span className="spinner" style={{ borderTopColor: '#fff' }} /> Syncing…</>
                  : 'Sync Menu'}
              </button>
              <p style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.5 }}>
                Sync takes around: 5–10 minutes. Please be patient and wait for completion and refresh afterward.
              </p>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '28px 0' }} />

              {/* ── Settings Sync ── */}
              <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>Settings Sync:</p>
              <p style={{ fontSize: '.875rem', color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
                Syncs all branches, restaurant images and configurations
              </p>
              <div style={{ marginBottom: 16 }}>
                <SyncRow label="Last Settings Sync" date={lastSync?.started_at ?? null} status={lastSync?.status} isLoading={syncing !== null} />
                <SyncRow label="Last Successful Settings Sync" date={lastOk?.started_at ?? null} />
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

              {/* ── Settings and Menu Sync ── */}
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
              <div style={{ margin: '0 auto 16px', opacity: 0.3, width: 'fit-content' }}>
                <FoodicsLogo size={48} />
              </div>
              <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: 8, color: 'var(--text)' }}>Connect with Foodics</p>
              <p style={{ fontSize: '.875rem', marginBottom: 24 }}>
                Connect your restaurant to Foodics to synchronize your menu and orders.
              </p>
              {authUrl && (
                <a href={authUrl} className="btn btn-primary" style={{ textDecoration: 'none' }}>Connect to Foodics</a>
              )}
            </div>
          )}

          {/* ── Sync history ─────────────────────────────────────── */}
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
  )
}

export default function FoodicsPage() {
  return (
    <DashLayout pageTitle="Foodics">
      <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>}>
        <FoodicsContent />
      </Suspense>
    </DashLayout>
  )
}
