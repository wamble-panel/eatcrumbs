'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { adminSignIn } from '../../lib/api'
import { setToken, getToken, isTokenExpired } from '../../lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Redirect if already logged in
  useEffect(() => {
    const t = getToken()
    if (t && !isTokenExpired(t)) router.replace('/orders')
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setError(null)
    try {
      const { token } = await adminSignIn(email.trim().toLowerCase(), password)
      setToken(token)
      router.replace('/orders')
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg)',
        padding: 16,
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 52,
              height: 52,
              background: 'var(--primary)',
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
              <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/>
            </svg>
          </div>
          <h1 style={{ fontWeight: 800, fontSize: '1.5rem', marginBottom: 4 }}>Welcome back</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '.9rem' }}>Sign in to your merchant dashboard</p>
        </div>

        {/* Form */}
        <div className="card" style={{ padding: 28 }}>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="email"
                placeholder="you@restaurant.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                className="input"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div
                style={{
                  background: '#fee2e2',
                  color: '#b91c1c',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: '.85rem',
                  marginBottom: 16,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '.7rem' }}
              disabled={loading}
            >
              {loading ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
