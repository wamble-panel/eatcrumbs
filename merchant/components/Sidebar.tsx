'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { clearToken, type AdminPayload } from '../lib/auth'
import type { FranchiseInfo, RestaurantInfo } from '../types'

interface Props {
  admin: AdminPayload | null
  restaurant: RestaurantInfo | null
  franchises: FranchiseInfo[]
  isOpen: boolean
  onClose: () => void
}

const NAV = [
  {
    href: '/orders',
    label: 'Live orders',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
  },
  {
    href: '/menu',
    label: 'Menu',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    ),
  },
  {
    href: '/branches',
    label: 'Branches',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: '/analytics',
    label: 'Analytics',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
]

export default function Sidebar({ admin, restaurant, franchises, isOpen, onClose }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  function handleLogout() {
    clearToken()
    router.replace('/login')
  }

  const sidebarContent = (
    <div
      style={{
        width: 'var(--sidebar-w)',
        background: 'var(--sidebar-bg)',
        color: 'var(--sidebar-text)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '0 0 16px',
        overflow: 'hidden',
      }}
    >
      {/* Brand */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <p style={{ fontWeight: 700, fontSize: '.95rem', color: 'var(--sidebar-text-active)' }}>
          {restaurant?.name ?? 'Dashboard'}
        </p>
        <p style={{ fontSize: '.75rem', marginTop: 2, opacity: .6 }}>{admin?.email}</p>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 10px' }}>
        {NAV.map(({ href, label, icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 8,
                marginBottom: 2,
                color: active ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)',
                background: active ? 'rgba(255,255,255,.1)' : 'transparent',
                textDecoration: 'none',
                fontWeight: active ? 600 : 400,
                fontSize: '.875rem',
                transition: 'all .15s',
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover)'
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              {icon}
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div style={{ padding: '0 10px' }}>
        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: '9px 12px',
            borderRadius: 8,
            background: 'none',
            border: 'none',
            color: 'var(--sidebar-text)',
            cursor: 'pointer',
            fontSize: '.875rem',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Logout
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop fixed sidebar */}
      <div
        style={{
          width: 'var(--sidebar-w)',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          height: '100vh',
        }}
        className="hidden md:block"
      >
        {sidebarContent}
      </div>

      {/* Mobile drawer */}
      {isOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100 }}
            onClick={onClose}
          />
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              zIndex: 101,
              animation: 'slideInLeft .2s ease',
            }}
          >
            {sidebarContent}
          </div>
          <style>{`@keyframes slideInLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }`}</style>
        </>
      )}
    </>
  )
}
