'use client'

import { useState, useEffect } from 'react'
import { adminGet, adminPost } from '../../lib/api'
import BranchModal from './BranchModal'
import type { Franchise, ScheduleSlot } from '../../types'

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function BranchList() {
  const [branches, setBranches] = useState<Franchise[]>([])
  const [loading, setLoading] = useState(true)
  const [editModal, setEditModal] = useState<{ franchise: Franchise; schedule: ScheduleSlot[] } | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadBranches() {
    setLoading(true)
    try {
      const { franchises } = await adminGet<{ franchises: Franchise[] }>('/franchise/list')
      setBranches(franchises)
    } catch {
      setError('Failed to load branches')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadBranches() }, [])

  async function openEditModal(franchise: Franchise) {
    try {
      const { schedule } = await adminGet<{ franchise: Franchise; schedule: ScheduleSlot[] }>(`/franchise/${franchise.id}`)
      setEditModal({ franchise, schedule })
    } catch {
      setEditModal({ franchise, schedule: [] })
    }
  }

  async function toggleOnline(franchise: Franchise) {
    setTogglingId(franchise.id)
    try {
      await adminPost('/franchise/toggle-online', {
        franchiseId: franchise.id,
        isOnline: !franchise.is_online,
      })
      setBranches((prev) =>
        prev.map((f) => f.id === franchise.id ? { ...f, is_online: !franchise.is_online } : f),
      )
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setTogglingId(null)
    }
  }

  async function toggleBusy(franchise: Franchise) {
    setTogglingId(franchise.id)
    try {
      await adminPost('/franchise/toggle-busy', {
        franchiseId: franchise.id,
        busyMode: !franchise.busy_mode,
      })
      setBranches((prev) =>
        prev.map((f) => f.id === franchise.id ? { ...f, busy_mode: !franchise.busy_mode } : f),
      )
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setTogglingId(null)
    }
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontWeight: 800, fontSize: '1.4rem' }}>Branches</h1>
        <span style={{ fontSize: '.875rem', color: 'var(--text-muted)' }}>{branches.length} branch{branches.length !== 1 ? 'es' : ''}</span>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '.875rem' }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>✕</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {branches.map((branch) => (
          <div key={branch.id} className="card" style={{ padding: 20 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: '1rem' }}>{branch.name}</p>
                {branch.name_arabic && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '.85rem', marginTop: 2 }}>{branch.name_arabic}</p>
                )}
                {branch.address && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '.8rem', marginTop: 4 }}>📍 {branch.address}</p>
                )}
                {branch.phone && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '.8rem', marginTop: 2 }}>📞 {branch.phone}</p>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontSize: '.72rem',
                    padding: '3px 8px',
                    borderRadius: 999,
                    fontWeight: 700,
                    background: branch.is_online ? '#dcfce7' : '#f1f5f9',
                    color: branch.is_online ? '#15803d' : '#64748b',
                  }}
                >
                  {branch.is_online ? '● Online' : '○ Offline'}
                </span>
              </div>
            </div>

            {/* Toggles */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: '12px 0',
                borderTop: '1px solid var(--border)',
                borderBottom: '1px solid var(--border)',
                marginBottom: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '.875rem', fontWeight: 500 }}>Online (accepting orders)</span>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={branch.is_online}
                    disabled={togglingId === branch.id}
                    onChange={() => toggleOnline(branch)}
                  />
                  <span className="toggle-track" />
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: '.875rem', fontWeight: 500 }}>Busy mode</span>
                  <p style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>Warns customers of longer wait times</p>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={branch.busy_mode}
                    disabled={togglingId === branch.id}
                    onChange={() => toggleBusy(branch)}
                  />
                  <span className="toggle-track" />
                </label>
              </div>
            </div>

            {/* Edit button */}
            <button
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'center', fontSize: '.875rem' }}
              onClick={() => openEditModal(branch)}
            >
              Edit details & hours
            </button>
          </div>
        ))}
      </div>

      {editModal && (
        <BranchModal
          franchise={editModal.franchise}
          schedule={editModal.schedule}
          onClose={() => setEditModal(null)}
          onSaved={(updated) => {
            setBranches((prev) => prev.map((f) => f.id === updated.id ? { ...f, ...updated } : f))
            setEditModal(null)
          }}
        />
      )}
    </div>
  )
}
