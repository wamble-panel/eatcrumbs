'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getToken, isTokenExpired, decodeToken } from '../lib/auth'
import { adminGet } from '../lib/api'
import Sidebar from './Sidebar'
import type { AdminPayload, RestaurantInfo, FranchiseInfo } from '../types'

interface Props {
  children: React.ReactNode
  pageTitle?: string
}

const PAGE_NAMES: Record<string, string> = {
  '/orders':        'Live Orders',
  '/overview':      'Overview',
  '/analytics':     'Analytics',
  '/itemsales':     'Item Sales',
  '/menu':          'Menu Management',
  '/offers':        'Offers',
  '/branches':      'Branches',
  '/customers':     'Customer Profiles',
  '/feedback':      'Feedback',
  '/notifications': 'Notifications',
  '/foodics':       'Foodics',
}

export default function DashLayout({ children, pageTitle }: Props) {
  const router    = useRouter()
  const pathname  = usePathname()
  const [admin,        setAdmin]        = useState<AdminPayload | null>(null)
  const [restaurant,   setRestaurant]   = useState<RestaurantInfo | null>(null)
  const [franchises,   setFranchises]   = useState<FranchiseInfo[]>([])
  const [ready,        setReady]        = useState(false)
  const [sidebarOpen,  setSidebarOpen]  = useState(false)

  useEffect(() => {
    const token = getToken()
    if (!token || isTokenExpired(token)) {
      router.replace('/login')
      return
    }
    const payload = decodeToken(token)
    setAdmin(payload)

    adminGet<{ restaurant: RestaurantInfo; franchises: FranchiseInfo[] }>('/info')
      .then(({ restaurant: r, franchises: f }) => {
        setRestaurant(r)
        setFranchises(f)
      })
      .catch(() => {})
      .finally(() => setReady(true))
  }, [router])

  const currentName =
    pageTitle ??
    Object.entries(PAGE_NAMES).find(([k]) => pathname.startsWith(k))?.[1] ??
    restaurant?.name ??
    'Dashboard'

  if (!ready) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'var(--bg)',
      }}>
        <div className="spinner" style={{ width: 36, height: 36 }} />
      </div>
    )
  }

  return (
    <div className="dash-shell">
      <Sidebar
        admin={admin}
        restaurant={restaurant}
        franchises={franchises}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="dash-content">
        {/* TopBar — fixed 3.5rem, matches reference exactly */}
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '3.5rem',
          background: 'var(--bg)',
          zIndex: 2001,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 2rem',
          boxShadow: '0 1px 0 rgba(148,194,195,.3)',
        }}>
          {/* Left: hamburger + page name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', padding: 4, display: 'flex' }}
            >
              <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <span style={{ fontWeight: 600, fontSize: 22, color: 'var(--title-color)', textTransform: 'capitalize' }}>
              {currentName}
            </span>
          </div>

          {/* Right: branch count + role badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {franchises.length > 0 && (
              <span style={{
                background: 'var(--primary-bg)', color: 'var(--primary)',
                borderRadius: 8, padding: '4px 12px', fontSize: 14, fontWeight: 600,
              }}>
                {franchises.length} {franchises.length === 1 ? 'branch' : 'branches'}
              </span>
            )}
            {admin?.role && (
              <span style={{
                background: 'var(--primary)', color: '#fff',
                borderRadius: 8, padding: '4px 12px', fontSize: 14, fontWeight: 600,
                textTransform: 'capitalize',
              }}>
                {admin.role}
              </span>
            )}
          </div>
        </div>

        {children}
      </div>
    </div>
  )
}
