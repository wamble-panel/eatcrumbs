'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { adminPost, adminPostForm } from '../../lib/api'
import { getAdmin } from '../../lib/auth'
import type { AdminItem, AdminCategory } from '../../types'

interface Props {
  item?: AdminItem | null
  categories: AdminCategory[]
  defaultCategoryId?: number
  onClose: () => void
  onSaved: (item: AdminItem) => void
}

export default function ItemModal({ item, categories, defaultCategoryId, onClose, onSaved }: Props) {
  const admin = getAdmin()
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(item?.item_name ?? '')
  const [nameAr, setNameAr] = useState(item?.item_name_arabic ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [price, setPrice] = useState(String(item?.price ?? ''))
  const [categoryId, setCategoryId] = useState<number>(defaultCategoryId ?? categories[0]?.id ?? 0)
  const [visible, setVisible] = useState(item?.is_visible !== false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(item?.image ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    if (!name.trim() || !admin) return
    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum < 0) {
      setError('Invalid price')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const itemData: Record<string, unknown> = {
        restaurantId: admin.restaurant_id,
        item_name: name.trim(),
        item_name_arabic: nameAr.trim() || null,
        description: description.trim() || null,
        price: priceNum,
        categoryId,
        visible,
      }
      if (item?.id) itemData.id = item.id

      let saved: AdminItem
      if (imageFile) {
        const form = new FormData()
        form.append('itemData', JSON.stringify(itemData))
        form.append('uploadedImages', imageFile)
        saved = await adminPostForm<AdminItem>('/item/with-images', form)
      } else {
        saved = await adminPost<AdminItem>('/item', itemData)
      }
      onSaved(saved)
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
          <h2 style={{ fontWeight: 700 }}>{item ? 'Edit item' : 'New item'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.3rem', color: 'var(--text-muted)' }}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Name (English) *</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Name (Arabic)</label>
              <input className="input" dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
            </div>
          </div>

          <div className="field" style={{ marginTop: 12 }}>
            <label>Description</label>
            <textarea className="input" rows={2} style={{ resize: 'none' }} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Price *</label>
              <input className="input" type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Category</label>
              <select className="input" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.category_name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Image */}
          <div className="field" style={{ marginTop: 12 }}>
            <label>Image</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {imagePreview && (
                <div style={{ position: 'relative', width: 60, height: 60, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                  <Image src={imagePreview} alt="preview" fill style={{ objectFit: 'cover' }} />
                </div>
              )}
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: '.8rem' }}
                onClick={() => fileRef.current?.click()}
              >
                {imagePreview ? 'Change image' : 'Upload image'}
              </button>
              {imagePreview && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: '.8rem', color: '#ef4444' }}
                  onClick={() => { setImagePreview(null); setImageFile(null) }}
                >
                  Remove
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFileChange} />
            </div>
          </div>

          {/* Visible toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <label className="toggle">
              <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
              <span className="toggle-track" />
            </label>
            <span style={{ fontSize: '.875rem' }}>Visible to customers</span>
          </div>

          {error && (
            <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '8px 12px', fontSize: '.85rem', marginTop: 12 }}>{error}</div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !name.trim() || !price}>
            {saving ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
