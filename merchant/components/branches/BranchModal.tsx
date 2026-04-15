'use client'

import { useState } from 'react'
import { adminPost } from '../../lib/api'
import type { Franchise, ScheduleSlot } from '../../types'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface SlotDraft {
  dayOfWeek: number
  openTime: string
  closeTime: string
}

interface Props {
  franchise: Franchise
  schedule: ScheduleSlot[]
  onClose: () => void
  onSaved: (franchise: Franchise) => void
}

export default function BranchModal({ franchise, schedule, onClose, onSaved }: Props) {
  const [name, setName] = useState(franchise.name)
  const [nameAr, setNameAr] = useState(franchise.name_arabic ?? '')
  const [address, setAddress] = useState(franchise.address ?? '')
  const [phone, setPhone] = useState(franchise.phone ?? '')
  const [slots, setSlots] = useState<SlotDraft[]>(() =>
    schedule.map((s) => ({ dayOfWeek: s.day_of_week, openTime: s.open_time, closeTime: s.close_time })),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'details' | 'hours'>('details')

  function toggleDay(day: number) {
    if (slots.some((s) => s.dayOfWeek === day)) {
      setSlots((prev) => prev.filter((s) => s.dayOfWeek !== day))
    } else {
      setSlots((prev) => [...prev, { dayOfWeek: day, openTime: '09:00', closeTime: '22:00' }])
    }
  }

  function updateSlot(day: number, field: 'openTime' | 'closeTime', value: string) {
    setSlots((prev) => prev.map((s) => s.dayOfWeek === day ? { ...s, [field]: value } : s))
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const updated = await adminPost<Franchise>('/franchise/edit', {
        id: franchise.id,
        name: name.trim(),
        nameArabic: nameAr.trim() || null,
        slug: franchise.slug,
        address: address.trim() || null,
        phone: phone.trim() || null,
        isOnline: franchise.is_online,
        busyMode: franchise.busy_mode,
      })
      // Save schedule
      await adminPost('/franchise/schedule', {
        franchiseId: franchise.id,
        slots,
      })
      onSaved(updated)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2 style={{ fontWeight: 700 }}>Edit branch — {franchise.name}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.3rem', color: 'var(--text-muted)' }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
          {(['details', 'hours'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
                padding: '10px 16px',
                fontWeight: tab === t ? 700 : 400,
                color: tab === t ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '.875rem',
                marginBottom: -1,
                textTransform: 'capitalize',
              }}
            >
              {t === 'details' ? 'Details' : 'Opening hours'}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {tab === 'details' && (
            <>
              <div className="field">
                <label>Branch name *</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="field">
                <label>Name (Arabic)</label>
                <input className="input" dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
              </div>
              <div className="field">
                <label>Address</label>
                <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div className="field">
                <label>Phone</label>
                <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </>
          )}

          {tab === 'hours' && (
            <div>
              <p style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                Toggle days to set opening hours. Leave all off to be open 24/7 when branch is online.
              </p>
              {DAYS.map((day, idx) => {
                const slot = slots.find((s) => s.dayOfWeek === idx)
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '8px 0',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <label className="toggle" style={{ flexShrink: 0 }}>
                      <input type="checkbox" checked={!!slot} onChange={() => toggleDay(idx)} />
                      <span className="toggle-track" />
                    </label>
                    <span style={{ width: 90, fontSize: '.875rem', fontWeight: slot ? 600 : 400 }}>{day}</span>
                    {slot && (
                      <>
                        <input
                          className="input"
                          type="time"
                          value={slot.openTime}
                          onChange={(e) => updateSlot(idx, 'openTime', e.target.value)}
                          style={{ width: 110 }}
                        />
                        <span style={{ color: 'var(--text-muted)', fontSize: '.875rem' }}>to</span>
                        <input
                          className="input"
                          type="time"
                          value={slot.closeTime}
                          onChange={(e) => updateSlot(idx, 'closeTime', e.target.value)}
                          style={{ width: 110 }}
                        />
                      </>
                    )}
                    {!slot && <span style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>Closed</span>}
                  </div>
                )
              })}
            </div>
          )}

          {error && (
            <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '8px 12px', fontSize: '.85rem', marginTop: 12 }}>{error}</div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
