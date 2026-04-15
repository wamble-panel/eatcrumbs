'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { adminSignIn } from '../../lib/api'
import { setToken, getToken, isTokenExpired } from '../../lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  useEffect(() => {
    const t = getToken()
    if (t && !isTokenExpired(t)) router.replace('/orders')
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEmailError(null)
    setPasswordError(null)
    if (!email.trim()) { setEmailError('Email is required'); return }
    if (!password) { setPasswordError('Password is required'); return }
    setLoading(true)
    try {
      const { token } = await adminSignIn(email.trim().toLowerCase(), password)
      setToken(token)
      router.replace('/orders')
    } catch (err: unknown) {
      setPasswordError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: '#faffff', minHeight: '100vh' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        height: '80vh',
        width: '50%',
        margin: 'auto',
        padding: '0 2.5rem',
      }}>
        {/* Header */}
        <div style={{ width: '100%', marginBottom: '1rem' }}>
          <h1 style={{
            color: '#14b2b6',
            fontSize: '2rem',
            fontWeight: 700,
            margin: '0 0 4px',
          }}>
            Welcome back
          </h1>
          <p style={{ color: '#464646', margin: 0, fontSize: '1rem' }}>
            Sign in to your merchant dashboard
          </p>
        </div>

        {/* Form */}
        <div style={{ width: '100%' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '1rem' }}>
            {/* Email */}
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                autoComplete="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  borderRadius: 10,
                  border: 0,
                  width: '100%',
                  minHeight: 50,
                  padding: '15px 5%',
                  boxShadow: '0 2px 4px 0 rgba(148,194,195,0.5)',
                  outline: 'none',
                  fontWeight: 400,
                  color: '#151515',
                  fontSize: 16,
                  boxSizing: 'border-box',
                  background: '#fff',
                }}
              />
              {emailError && (
                <span style={{ color: '#ff9785', position: 'absolute', left: 0, bottom: -22, fontSize: 13 }}>
                  {emailError}
                </span>
              )}
            </div>

            {/* Password */}
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  borderRadius: 10,
                  border: 0,
                  width: '100%',
                  minHeight: 50,
                  padding: '15px 5%',
                  paddingRight: '15%',
                  boxShadow: '0 2px 4px 0 rgba(148,194,195,0.5)',
                  outline: 'none',
                  fontWeight: 400,
                  color: '#151515',
                  fontSize: 16,
                  boxSizing: 'border-box',
                  background: '#fff',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  position: 'absolute',
                  top: '55%',
                  transform: 'translateY(-50%)',
                  right: 15,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                }}
              >
                {showPassword ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a6a6a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a6a6a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
              {passwordError && (
                <span style={{ color: '#ff9785', position: 'absolute', left: 0, bottom: -22, fontSize: 13 }}>
                  {passwordError}
                </span>
              )}
            </div>

            {/* Forgot password */}
            <span
              style={{ fontWeight: 600, color: '#14b2b6', cursor: 'pointer', width: 'fit-content', fontSize: 14, marginTop: 4 }}
              onClick={() => router.push('/forgot-password')}
            >
              Forgot password?
            </span>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                all: 'unset',
                cursor: loading ? 'not-allowed' : 'pointer',
                borderRadius: 10,
                width: '100%',
                minHeight: 46,
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: 20,
                backgroundColor: loading ? 'rgba(20,178,182,0.6)' : '#14b2b6',
                color: '#fff',
                border: '1px solid transparent',
                marginTop: '0.5rem',
                padding: '0.5rem 1rem',
                transition: 'all 225ms cubic-bezier(.4,0,.6,1)',
                letterSpacing: '0.5px',
                boxSizing: 'border-box',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(250,255,255,0.44)'
                  ;(e.currentTarget as HTMLButtonElement).style.color = '#14b2b6'
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#14b2b6'
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#14b2b6'
                  ;(e.currentTarget as HTMLButtonElement).style.color = '#fff'
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'
                }
              }}
            >
              {loading ? (
                <span style={{
                  width: 20, height: 20, border: '2px solid rgba(255,255,255,0.4)',
                  borderTop: '2px solid #fff', borderRadius: '50%',
                  display: 'inline-block', animation: 'spin 0.8s linear infinite',
                }} />
              ) : 'Sign in'}
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @media (max-width: 575.98px) {
          .login-wrapper { width: 100% !important; padding: 0 1rem !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #a6a6a6; }
      `}</style>
    </div>
  )
}
