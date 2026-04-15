'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { adminGet, adminPost } from '../../lib/api'
import { getAdmin } from '../../lib/auth'
import CategoryModal from './CategoryModal'
import ItemModal from './ItemModal'
import type { AdminCategory, AdminItem } from '../../types'

function toggleSet<T>(set: Set<T>, val: T): Set<T> {
  const next = new Set(set)
  if (next.has(val)) next.delete(val)
  else next.add(val)
  return next
}

export default function MenuManager() {
  const admin = getAdmin()
  const [categories, setCategories] = useState<AdminCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [catModal, setCatModal] = useState<AdminCategory | null | false>(false) // false=closed, null=new, obj=edit
  const [itemModal, setItemModal] = useState<{ item?: AdminItem | null; categoryId?: number } | false>(false)
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'cat' | 'item'; id: number; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadMenu() {
    if (!admin) return
    setLoading(true)
    try {
      const data = await adminGet<AdminCategory[]>(`/category/details/${admin.restaurant_id}`)
      setCategories(data)
      if (data.length > 0 && expanded.size === 0) {
        setExpanded(new Set([data[0].id]))
      }
    } catch {
      setError('Failed to load menu')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadMenu() }, []) // eslint-disable-line

  async function handleDeleteCategory(id: number) {
    if (!admin) return
    setDeleting(true)
    try {
      await adminPost('/category/delete', { id, restaurantId: admin.restaurant_id })
      setCategories((prev) => prev.filter((c) => c.id !== id))
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setDeleting(false)
      setConfirmDelete(null)
    }
  }

  async function handleDeleteItem(itemId: number) {
    if (!admin) return
    setDeleting(true)
    try {
      await adminPost('/item', { id: itemId, restaurantId: admin.restaurant_id, item_name: '_deleted', price: 0, visible: false })
      // Reload to get fresh state (soft-delete via backend)
      await loadMenu()
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setDeleting(false)
      setConfirmDelete(null)
    }
  }

  function onCategorySaved(saved: AdminCategory) {
    setCategories((prev) => {
      const idx = prev.findIndex((c) => c.id === saved.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...prev[idx], ...saved }
        return next
      }
      return [...prev, { ...saved, itemCategories: [] }]
    })
    setCatModal(false)
  }

  function onItemSaved(saved: AdminItem) {
    setCategories((prev) =>
      prev.map((cat) => {
        const existing = cat.itemCategories?.findIndex((ic) => ic.item.id === saved.id) ?? -1
        if (existing >= 0) {
          const ic = [...(cat.itemCategories ?? [])]
          ic[existing] = { item: saved }
          return { ...cat, itemCategories: ic }
        }
        if (itemModal && (itemModal as { categoryId?: number }).categoryId === cat.id) {
          return { ...cat, itemCategories: [...(cat.itemCategories ?? []), { item: saved }] }
        }
        return cat
      }),
    )
    setItemModal(false)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontWeight: 800, fontSize: '1.4rem' }}>Menu</h1>
        <button className="btn btn-primary" onClick={() => setCatModal(null)}>
          + Add category
        </button>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '.875rem' }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {categories.length === 0 && (
        <div className="card" style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <p>No categories yet. Add one to start building your menu.</p>
        </div>
      )}

      {/* Categories */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {categories.map((cat) => {
          const isOpen = expanded.has(cat.id)
          const items = cat.itemCategories ?? []
          return (
            <div key={cat.id} className="card" style={{ overflow: 'hidden' }}>
              {/* Category header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  cursor: 'pointer',
                  background: isOpen ? 'var(--bg)' : 'var(--card-bg)',
                  transition: 'background .15s',
                }}
                onClick={() => setExpanded((s) => toggleSet(s, cat.id))}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '1rem', transition: 'transform .2s', transform: isOpen ? 'rotate(90deg)' : '' }}>›</span>
                  <span style={{ fontWeight: 700 }}>{cat.category_name}</span>
                  {cat.category_name_arabic && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '.85rem' }}>{cat.category_name_arabic}</span>
                  )}
                  <span
                    style={{
                      background: 'var(--border)',
                      color: 'var(--text-muted)',
                      borderRadius: 999,
                      padding: '2px 8px',
                      fontSize: '.75rem',
                      fontWeight: 600,
                    }}
                  >
                    {items.length}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: '.3rem .6rem', fontSize: '.78rem' }}
                    onClick={() => setCatModal(cat)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: '.3rem .6rem', fontSize: '.78rem', color: '#ef4444' }}
                    onClick={() => setConfirmDelete({ type: 'cat', id: cat.id, name: cat.category_name })}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Items */}
              {isOpen && (
                <div>
                  {items.length === 0 && (
                    <p style={{ padding: '12px 18px', color: 'var(--text-muted)', fontSize: '.875rem' }}>
                      No items yet.
                    </p>
                  )}
                  {items.map(({ item }) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 18px',
                        borderTop: '1px solid var(--border)',
                      }}
                    >
                      {item.image ? (
                        <div style={{ position: 'relative', width: 44, height: 44, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                          <Image src={item.image} alt={item.item_name} fill style={{ objectFit: 'cover' }} />
                        </div>
                      ) : (
                        <div style={{ width: 44, height: 44, background: 'var(--bg)', borderRadius: 8, flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 600, fontSize: '.875rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {item.item_name}
                          {!item.is_visible && (
                            <span style={{ fontSize: '.7rem', background: '#f1f5f9', color: 'var(--text-muted)', borderRadius: 4, padding: '1px 5px' }}>
                              Hidden
                            </span>
                          )}
                        </p>
                        {item.item_name_arabic && (
                          <p style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>{item.item_name_arabic}</p>
                        )}
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '.9rem', flexShrink: 0 }}>
                        {Number(item.price).toFixed(2)}
                      </span>
                      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '.25rem .5rem', fontSize: '.78rem' }}
                          onClick={() => setItemModal({ item, categoryId: cat.id })}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '.25rem .5rem', fontSize: '.78rem', color: '#ef4444' }}
                          onClick={() => setConfirmDelete({ type: 'item', id: item.id, name: item.item_name })}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Add item button */}
                  <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)' }}>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: '.8rem' }}
                      onClick={() => setItemModal({ item: null, categoryId: cat.id })}
                    >
                      + Add item
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Category modal */}
      {catModal !== false && (
        <CategoryModal
          category={catModal}
          onClose={() => setCatModal(false)}
          onSaved={onCategorySaved}
        />
      )}

      {/* Item modal */}
      {itemModal !== false && (
        <ItemModal
          item={(itemModal as { item?: AdminItem | null }).item}
          categories={categories}
          defaultCategoryId={(itemModal as { categoryId?: number }).categoryId}
          onClose={() => setItemModal(false)}
          onSaved={onItemSaved}
        />
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontWeight: 700 }}>Delete {confirmDelete.type === 'cat' ? 'category' : 'item'}</h2>
            </div>
            <div className="modal-body">
              <p>
                Delete <strong>{confirmDelete.name}</strong>?
                {confirmDelete.type === 'cat' && ' All items in this category will also be hidden.'}
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button
                className="btn btn-danger"
                disabled={deleting}
                onClick={() => {
                  if (confirmDelete.type === 'cat') handleDeleteCategory(confirmDelete.id)
                  else handleDeleteItem(confirmDelete.id)
                }}
              >
                {deleting ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
