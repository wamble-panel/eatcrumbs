'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useCartStore } from '../../lib/store'
import type { Item, AddonGroup, AddonValue, CartAddon } from '../../types'

interface Props {
  item: Item
  isRtl?: boolean
  currency?: string
  onClose: () => void
}

export default function ItemModal({ item, isRtl, currency = 'EGP', onClose }: Props) {
  const addItem = useCartStore((s) => s.addItem)
  const [quantity, setQuantity] = useState(1)
  const [selectedAddons, setSelectedAddons] = useState<Record<number, number[]>>({})
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const name = isRtl && item.name_arabic ? item.name_arabic : item.name
  const desc = isRtl && item.description_arabic ? item.description_arabic : item.description

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function toggleAddon(group: AddonGroup, valueId: number) {
    setSelectedAddons((prev) => {
      const current = prev[group.id] ?? []
      const isSelected = current.includes(valueId)
      if (group.max_select === 1) {
        // Radio (single select)
        return { ...prev, [group.id]: isSelected ? [] : [valueId] }
      }
      // Checkbox (multi-select)
      if (isSelected) {
        return { ...prev, [group.id]: current.filter((id) => id !== valueId) }
      }
      if (current.length >= group.max_select) return prev // at max
      return { ...prev, [group.id]: [...current, valueId] }
    })
  }

  function isAddonSelected(groupId: number, valueId: number): boolean {
    return (selectedAddons[groupId] ?? []).includes(valueId)
  }

  function validate(): boolean {
    for (const group of item.addonGroups) {
      if (group.is_required) {
        const chosen = selectedAddons[group.id] ?? []
        if (chosen.length < group.min_select) {
          setError(
            isRtl
              ? `يرجى اختيار ${group.min_select} على الأقل من "${isRtl && group.name_arabic ? group.name_arabic : group.name}"`
              : `Please select at least ${group.min_select} from "${group.name}"`,
          )
          return false
        }
      }
    }
    setError(null)
    return true
  }

  function buildCartAddons(): CartAddon[] {
    const result: CartAddon[] = []
    for (const group of item.addonGroups) {
      const chosen = selectedAddons[group.id] ?? []
      for (const valueId of chosen) {
        const val = group.values.find((v) => v.id === valueId)
        if (!val) continue
        result.push({
          groupId: group.id,
          groupName: group.name,
          groupNameArabic: group.name_arabic,
          valueId: val.id,
          name: val.name,
          nameArabic: val.name_arabic,
          price: val.price,
        })
      }
    }
    return result
  }

  function computeTotal(): number {
    const addonsSum = buildCartAddons().reduce((s, a) => s + a.price, 0)
    return (item.price + addonsSum) * quantity
  }

  function handleAdd() {
    if (!validate()) return
    addItem({
      itemId: item.id,
      name: item.name,
      nameArabic: item.name_arabic,
      price: item.price,
      quantity,
      addons: buildCartAddons(),
      notes: notes || undefined,
    })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-sheet">
        {/* Image */}
        {item.image_url && (
          <div style={{ position: 'relative', width: '100%', height: 220 }}>
            <Image
              src={item.image_url}
              alt={name}
              fill
              style={{ objectFit: 'cover' }}
            />
          </div>
        )}

        <div style={{ padding: '20px 20px 100px' }}>
          {/* Close + name */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
            <h2 style={{ fontWeight: 700, fontSize: '1.2rem', flex: 1 }}>{name}</h2>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.4rem', color: 'var(--text-muted)', marginLeft: 8 }}
            >
              ✕
            </button>
          </div>

          {desc && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 12, lineHeight: 1.5 }}>{desc}</p>
          )}

          <p style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 20 }}>
            {item.price.toFixed(2)} {currency}
          </p>

          {/* Addon groups */}
          {item.addonGroups.map((group) => {
            const groupName = isRtl && group.name_arabic ? group.name_arabic : group.name
            const isRadio = group.max_select === 1
            return (
              <div key={group.id} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                  <p style={{ fontWeight: 700 }}>{groupName}</p>
                  {group.is_required ? (
                    <span style={{ fontSize: '0.72rem', background: 'var(--primary)', color: '#fff', borderRadius: 4, padding: '2px 6px' }}>
                      {isRtl ? 'مطلوب' : 'Required'}
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {isRtl ? 'اختياري' : 'Optional'}
                    </span>
                  )}
                  {!isRadio && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {isRtl ? `(حتى ${group.max_select})` : `(up to ${group.max_select})`}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {group.values.map((val) => {
                    const valName = isRtl && val.name_arabic ? val.name_arabic : val.name
                    const selected = isAddonSelected(group.id, val.id)
                    return (
                      <button
                        key={val.id}
                        onClick={() => toggleAddon(group, val.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: 10,
                          border: selected ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                          background: selected ? 'rgba(var(--primary-rgb, 232,93,4),.06)' : 'transparent',
                          cursor: 'pointer',
                          transition: 'all 0.12s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: isRadio ? '50%' : 5,
                              border: selected ? 'none' : '2px solid var(--border)',
                              background: selected ? 'var(--primary)' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {selected && (
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="white">
                                <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
                              </svg>
                            )}
                          </span>
                          <span style={{ fontWeight: selected ? 600 : 400 }}>{valName}</span>
                        </div>
                        {val.price > 0 && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            +{val.price.toFixed(2)} {currency}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Notes */}
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
              {isRtl ? 'ملاحظات' : 'Special instructions'}
            </label>
            <textarea
              className="input"
              rows={2}
              placeholder={isRtl ? 'أي طلبات خاصة؟' : 'Any special requests?'}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ resize: 'none' }}
            />
          </div>

          {error && (
            <p style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: 8 }}>{error}</p>
          )}
        </div>

        {/* Sticky bottom bar */}
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            background: 'var(--card-bg)',
            borderTop: '1px solid var(--border)',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {/* Quantity control */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: '1.5px solid var(--border)',
              borderRadius: 999,
              padding: '4px 8px',
            }}
          >
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '1.1rem', width: 24, height: 24 }}
            >
              −
            </button>
            <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{quantity}</span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '1.1rem', width: 24, height: 24 }}
            >
              +
            </button>
          </div>

          {/* Add to cart */}
          <button
            onClick={handleAdd}
            className="btn-primary"
            style={{ flex: 1 }}
          >
            {isRtl ? 'أضف إلى السلة' : 'Add to cart'} · {computeTotal().toFixed(2)} {currency}
          </button>
        </div>
      </div>
    </div>
  )
}
