'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getToken, isTokenExpired, decodeToken } from '../lib/auth'
import { adminGet } from '../lib/api'
import Sidebar from './Sidebar'
import type { AdminPayload, RestaurantInfo, FranchiseInfo } from '../types'

interface Props {
  children: React.ReactNode
  pageTitle?: string
}

export default function DashLayout({ children, pageTitle }: Props) {
  const router = useRouter()
  const [admin, setAdmin] = useState<AdminPayload | null>(null)
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null)
  const [franchises, setFranchises] = useState<FranchiseInfo[]>([])
  const [ready, setReady] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const token = getToken()
    if (!token || isTokenExpired(token)) {
      router.replace('/login')
      return
    }
    const payload = decodeToken(token)
    setAdmin(payload)

    // Fetch restaurant info
    adminGet<{ restaurant: RestaurantInfo; franchises: FranchiseInfo[] }>('/info')
      .then(({ restaurant: r, franchises: f }) => {
        setRestaurant(r)
        setFranchises(f)
      })
      .catch(() => {})
      .finally(() => setReady(true))
  }, [router])

  if (!ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="spinner" />
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
        {/* Mobile top bar */}
        <div
          className="md:hidden"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--card-bg)',
            position: 'sticky',
            top: 0,
            zIndex: 50,
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', padding: 4 }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <span style={{ fontWeight: 700, fontSize: '.95rem' }}>{pageTitle ?? restaurant?.name ?? 'Dashboard'}</span>
        </div>

        {children}
      </div>
    </div>
  )
}
