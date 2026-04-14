'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getToken, isTokenExpired } from '../lib/auth'

export default function RootPage() {
  const router = useRouter()
  useEffect(() => {
    const token = getToken()
    if (!token || isTokenExpired(token)) {
      router.replace('/login')
    } else {
      router.replace('/orders')
    }
  }, [router])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="spinner" />
    </div>
  )
}
