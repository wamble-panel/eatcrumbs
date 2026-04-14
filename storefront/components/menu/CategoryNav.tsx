'use client'

import { useEffect, useRef } from 'react'
import type { Category } from '../../types'

interface Props {
  categories: Category[]
  activeId: number | null
  isRtl?: boolean
  onSelect: (id: number) => void
}

export default function CategoryNav({ categories, activeId, isRtl, onSelect }: Props) {
  const listRef = useRef<HTMLDivElement>(null)

  // Scroll active category pill into view
  useEffect(() => {
    if (!listRef.current || !activeId) return
    const btn = listRef.current.querySelector<HTMLElement>(`[data-cat="${activeId}"]`)
    btn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeId])

  return (
    <nav
      style={{
        height: 'var(--catnav-h)',
        background: 'var(--card-bg)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 'var(--header-h)',
        zIndex: 40,
      }}
    >
      <div
        ref={listRef}
        className="hide-scrollbar"
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          height: '100%',
          alignItems: 'center',
          padding: '0 16px',
          maxWidth: 700,
          margin: '0 auto',
        }}
      >
        {categories.map((cat) => {
          const isActive = cat.id === activeId
          const label = isRtl && cat.name_arabic ? cat.name_arabic : cat.name
          return (
            <button
              key={cat.id}
              data-cat={cat.id}
              onClick={() => onSelect(cat.id)}
              style={{
                flexShrink: 0,
                padding: '6px 14px',
                borderRadius: 999,
                border: isActive ? 'none' : '1.5px solid var(--border)',
                background: isActive ? 'var(--primary)' : 'transparent',
                color: isActive ? '#fff' : 'var(--text)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
