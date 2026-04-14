'use client'

import Image from 'next/image'
import type { Item } from '../../types'

interface Props {
  item: Item
  isRtl?: boolean
  currency?: string
  onClick: () => void
}

export default function ItemCard({ item, isRtl, currency = 'EGP', onClick }: Props) {
  const name = isRtl && item.name_arabic ? item.name_arabic : item.name
  const desc = isRtl && item.description_arabic ? item.description_arabic : item.description
  const hasAddons = item.addonGroups && item.addonGroups.length > 0

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        cursor: 'pointer',
        textAlign: isRtl ? 'right' : 'left',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,.1)'
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = ''
      }}
    >
      {/* Image */}
      {item.image_url ? (
        <div style={{ position: 'relative', width: '100%', paddingTop: '60%' }}>
          <Image
            src={item.image_url}
            alt={name}
            fill
            style={{ objectFit: 'cover' }}
            sizes="(max-width: 640px) 50vw, 200px"
          />
        </div>
      ) : (
        <div
          style={{
            width: '100%',
            paddingTop: '60%',
            background: 'var(--bg)',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--border)',
            }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/>
            </svg>
          </div>
        </div>
      )}

      {/* Info */}
      <div style={{ padding: '10px 12px 12px' }}>
        <p style={{ fontWeight: 600, fontSize: '0.9rem', lineHeight: 1.3, marginBottom: 4 }}>
          {name}
        </p>
        {desc && (
          <p
            style={{
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              marginBottom: 8,
            }}
          >
            {desc}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem' }}>
            {item.price.toFixed(2)} {currency}
          </span>
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'var(--primary)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              flexShrink: 0,
            }}
          >
            +
          </span>
        </div>
        {hasAddons && (
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {isRtl ? 'خيارات متاحة' : 'Customizable'}
          </p>
        )}
      </div>
    </button>
  )
}
