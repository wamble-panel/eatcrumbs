'use client'

import { useState } from 'react'
import { adminPost } from '../../lib/api'
import { getAdmin } from '../../lib/auth'
import type { AdminCategory } from '../../types'

interface Props {
  category?: AdminCategory | null
  onClose: () => void
  onSaved: (cat: AdminCategory) => void
}

export default function CategoryModal({ category, onClose, onSaved }: Props) {
  const admin = getAdmin()
  const [name, setName] = useState(category?.category_name ?? '')
  const [nameAr, setNameAr] = useState(category?.category_name_arabic ?? '')
  const [description, setDescription] = useState(category?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim() || !admin) return
    setSaving(true)
    setError(null)
    try {
      const path = category?.id ? '/category/edit' : '/category'
      const body: Record<string, unknown> = {
        restaurantId: admin.restaurant_id,
        category_name: name.trim(),
        category_name_arabic: nameAr.trim() || null,
        description: description.trim() || null,
      }
      if (category?.id) body.id = category.id
      const saved = await adminPost<AdminCategory>(path, body)
      onSaved(saved)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2 style={{ fontWeight: 700 }}>{category ? 'Edit category' : 'New category'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.3rem', color: 'var(--text-muted)' }}>✕</button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Name (English) *</label>
            <input className="input" placeholder="e.g. Burgers" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Name (Arabic)</label>
            <input className="input" dir="rtl" placeholder="مثال: برجر" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea className="input" rows={2} style={{ resize: 'none' }} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {error && (
            <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '8px 12px', fontSize: '.85rem' }}>{error}</div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
