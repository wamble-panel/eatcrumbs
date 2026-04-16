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
    label: 'Live Orders',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
  },
  {
    href: '/overview',
    label: 'Overview',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    href: '/analytics',
    label: 'Analytics',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    href: '/itemsales',
    label: 'Item Sales',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
    ),
  },
  {
    href: '/menu',
    label: 'Menu',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    ),
  },
  {
    href: '/offers',
    label: 'Offers',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
      </svg>
    ),
  },
  {
    href: '/branches',
    label: 'Branches',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: '/customers',
    label: 'Customers',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    href: '/feedback',
    label: 'Feedback',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  {
    href: '/notifications',
    label: 'Notifications',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    ),
  },
  {
    href: '/foodics',
    label: 'Foodics',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
      </svg>
    ),
  },
  {
    href: '/language',
    label: 'Language',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
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
    <div style={{
      width: 'var(--sidebar-w)',
      background: 'var(--primary-bg-light)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflowY: 'auto',
      overflowX: 'hidden',
    }}>
      {/* Logo / Brand header — 80px height matching reference */}
      <div style={{
        height: 80,
        display: 'flex',
        alignItems: 'center',
        paddingInlineStart: 20,
        flexShrink: 0,
        borderBottom: '1px solid rgba(20,178,182,.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Logo mark */}
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow)',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/>
            </svg>
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: 16, color: '#151515', lineHeight: 1.2, margin: 0 }}>
              {restaurant?.name ?? 'Dashboard'}
            </p>
            {admin?.email && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                {admin.email.split('@')[0]}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Nav list — reference: 65px item height, 22px font, 30px icons */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              style={{
                height: 65,
                display: 'flex',
                width: '100%',
                alignItems: 'center',
                textDecoration: 'none',
                color: active ? 'var(--primary)' : 'var(--text)',
                background: active ? 'var(--bg)' : 'transparent',
                boxShadow: active ? 'var(--shadow)' : 'none',
                transition: 'all .15s',
                borderLeft: active ? '3px solid var(--primary)' : '3px solid transparent',
              }}
              onMouseEnter={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--primary-bg)'
              }}
              onMouseLeave={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              {/* Icon */}
              <span style={{
                minWidth: 65,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                color: active ? 'var(--primary)' : '#464646',
              }}>
                {icon}
              </span>
              {/* Label */}
              <span style={{
                padding: '.5rem',
                fontSize: 20,
                fontWeight: active ? 600 : 400,
                flex: 1,
                color: active ? 'var(--primary)' : '#464646',
              }}>
                {label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div style={{ flexShrink: 0, borderTop: '1px solid rgba(20,178,182,.1)' }}>
        <button
          onClick={handleLogout}
          style={{
            height: 65,
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            background: 'none',
            border: 'none',
            color: '#464646',
            cursor: 'pointer',
            transition: 'all .15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-bg)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <span style={{ minWidth: 65, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </span>
          <span style={{ fontSize: 20, fontWeight: 400 }}>Logout</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sticky sidebar — CSS class controls visibility, not Tailwind */}
      <div
        style={{ width: 'var(--sidebar-w)', flexShrink: 0, position: 'sticky', top: 0, height: '100vh' }}
        className="sidebar-desktop"
      >
        {sidebarContent}
      </div>

      {/* Mobile drawer */}
      {isOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(70,70,70,.8)', zIndex: 2000 }}
            onClick={onClose}
          />
          <div style={{
            position: 'fixed', top: 0, left: 0, bottom: 0,
            zIndex: 2001, animation: 'slideInLeft .2s ease',
          }}>
            {sidebarContent}
          </div>
        </>
      )}
    </>
  )
}
