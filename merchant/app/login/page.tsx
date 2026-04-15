'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { adminSignIn } from '../../lib/api'
import { setToken, getToken, isTokenExpired } from '../../lib/auth'

interface Toast {
  id: number
  message: string
  type: 'error' | 'success'
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [emailTouched, setEmailTouched] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [toastCounter, setToastCounter] = useState(0)

  useEffect(() => {
    const t = getToken()
    if (t && !isTokenExpired(t)) router.replace('/orders')
  }, [router])

  const addToast = useCallback((message: string, type: Toast['type'] = 'error') => {
    const id = toastCounter + 1
    setToastCounter(id)
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [toastCounter])

  const dismissToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id))

  function validateEmail(val: string) {
    if (!val.trim()) return 'Email is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'Enter a valid email address'
    return null
  }

  function validatePassword(val: string) {
    if (!val) return 'Password is required'
    if (val.length < 6) return 'Password must be at least 6 characters'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const eErr = validateEmail(email)
    const pErr = validatePassword(password)
    setEmailError(eErr)
    setPasswordError(pErr)
    setEmailTouched(true)
    setPasswordTouched(true)
    if (eErr || pErr) {
      addToast(eErr ?? pErr ?? 'Please fix the errors above')
      return
    }
    setLoading(true)
    try {
      const { token } = await adminSignIn(email.trim().toLowerCase(), password)
      setToken(token)
      addToast('Signed in successfully!', 'success')
      setTimeout(() => router.replace('/orders'), 600)
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Sign in failed. Please try again.'
      setPasswordError(msg)
      addToast(msg)
    } finally {
      setLoading(false)
    }
  }

  const PRIMARY = '#EBA84B'
  const PRIMARY_HOVER_BG = 'rgba(235,168,75,0.08)'
  const SHADOW = '0 2px 4px 0 rgba(235,168,75,0.25)'
  const SHADOW_FOCUS = '0 0 0 3px rgba(235,168,75,0.22)'

  const inputStyle = (hasError: boolean, touched: boolean): React.CSSProperties => ({
    borderRadius: 10,
    border: `1.5px solid ${touched && hasError ? '#ff9785' : 'transparent'}`,
    width: '100%',
    minHeight: 50,
    padding: '15px 5%',
    boxShadow: SHADOW,
    outline: 'none',
    fontWeight: 400,
    color: '#151515',
    fontSize: 16,
    boxSizing: 'border-box',
    background: '#fff',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  })

  return (
    <div style={{ background: '#fafaf8', minHeight: '100vh', position: 'relative' }}>

      {/* Toast container */}
      <div style={{
        position: 'fixed', top: 20, right: 20, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360,
      }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              background: toast.type === 'error' ? '#1a1a1a' : '#1a1a1a',
              color: '#fff',
              borderRadius: 12,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
              borderLeft: `4px solid ${toast.type === 'error' ? '#ff9785' : PRIMARY}`,
              animation: 'slideIn 0.3s ease',
              fontSize: 14,
              fontWeight: 500,
              lineHeight: 1.4,
            }}
          >
            {/* Icon */}
            <span style={{ flexShrink: 0, marginTop: 1 }}>
              {toast.type === 'error' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#ff9785" strokeWidth="2"/>
                  <line x1="12" y1="8" x2="12" y2="12" stroke="#ff9785" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="12" cy="16" r="1" fill="#ff9785"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke={PRIMARY} strokeWidth="2"/>
                  <polyline points="9,12 11,14 15,10" stroke={PRIMARY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </span>
            <span style={{ flex: 1 }}>{toast.message}</span>
            <button
              onClick={() => dismissToast(toast.id)}
              style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 0, fontSize: 16, lineHeight: 1, flexShrink: 0 }}
            >×</button>
          </div>
        ))}
      </div>

      {/* Full-screen loading overlay */}
      {loading && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9000, backdropFilter: 'blur(2px)',
          animation: 'fadeIn 0.15s ease',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 48, height: 48,
              border: `4px solid rgba(235,168,75,0.2)`,
              borderTop: `4px solid ${PRIMARY}`,
              borderRadius: '50%',
              animation: 'spin 0.75s linear infinite',
              margin: '0 auto 12px',
            }} />
            <p style={{ color: '#464646', fontSize: 14, fontWeight: 600, margin: 0 }}>Signing in…</p>
          </div>
        </div>
      )}

      {/* Main form */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', height: '80vh',
        width: '50%', margin: 'auto', padding: '0 2.5rem',
      }} className="login-wrapper">

        {/* Header */}
        <div style={{ width: '100%', marginBottom: '1.5rem' }}>
          {/* Logo mark */}
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: PRIMARY, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 16, boxShadow: `0 4px 12px rgba(235,168,75,0.35)`,
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/>
            </svg>
          </div>
          <h1 style={{ color: PRIMARY, fontSize: '2rem', fontWeight: 700, margin: '0 0 4px' }}>
            Welcome back
          </h1>
          <p style={{ color: '#888', margin: 0, fontSize: '0.95rem' }}>
            Sign in to your merchant dashboard
          </p>
        </div>

        {/* Form */}
        <div style={{ width: '100%' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '1.1rem' }} noValidate>

            {/* Email field */}
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                autoComplete="email"
                placeholder="Email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (emailTouched) setEmailError(validateEmail(e.target.value))
                }}
                onBlur={() => { setEmailTouched(true); setEmailError(validateEmail(email)) }}
                onFocus={(e) => { e.currentTarget.style.boxShadow = SHADOW_FOCUS }}
                // @ts-ignore
                onBlurCapture={(e) => { e.currentTarget.style.boxShadow = SHADOW }}
                style={inputStyle(!!emailError, emailTouched)}
              />
              {emailTouched && emailError && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  color: '#ff9785', fontSize: 12, fontWeight: 500,
                  marginTop: 5, paddingLeft: 4,
                  animation: 'fadeInDown 0.2s ease',
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="#ff9785" strokeWidth="2"/>
                    <line x1="12" y1="8" x2="12" y2="12" stroke="#ff9785" strokeWidth="2" strokeLinecap="round"/>
                    <circle cx="12" cy="16" r="1" fill="#ff9785"/>
                  </svg>
                  {emailError}
                </div>
              )}
            </div>

            {/* Password field */}
            <div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (passwordTouched) setPasswordError(validatePassword(e.target.value))
                  }}
                  onBlur={() => { setPasswordTouched(true); setPasswordError(validatePassword(password)) }}
                  onFocus={(e) => { e.currentTarget.style.boxShadow = SHADOW_FOCUS }}
                  // @ts-ignore
                  onBlurCapture={(e) => { e.currentTarget.style.boxShadow = SHADOW }}
                  style={{ ...inputStyle(!!passwordError, passwordTouched), paddingRight: '14%' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                    right: 15, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', cursor: 'pointer',
                    background: 'none', border: 'none', padding: 0, color: '#a6a6a6',
                  }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
              {passwordTouched && passwordError && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  color: '#ff9785', fontSize: 12, fontWeight: 500,
                  marginTop: 5, paddingLeft: 4,
                  animation: 'fadeInDown 0.2s ease',
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="#ff9785" strokeWidth="2"/>
                    <line x1="12" y1="8" x2="12" y2="12" stroke="#ff9785" strokeWidth="2" strokeLinecap="round"/>
                    <circle cx="12" cy="16" r="1" fill="#ff9785"/>
                  </svg>
                  {passwordError}
                </div>
              )}
            </div>

            {/* Forgot password */}
            <span
              role="button"
              tabIndex={0}
              onClick={() => router.push('/forgot-password')}
              onKeyDown={(e) => e.key === 'Enter' && router.push('/forgot-password')}
              style={{
                fontWeight: 600, color: PRIMARY, cursor: 'pointer',
                width: 'fit-content', fontSize: 13, marginTop: -4,
                textDecoration: 'underline', textDecorationColor: 'transparent',
                transition: 'text-decoration-color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecorationColor = PRIMARY)}
              onMouseLeave={(e) => (e.currentTarget.style.textDecorationColor = 'transparent')}
            >
              Forgot password?
            </span>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                all: 'unset', cursor: loading ? 'not-allowed' : 'pointer',
                borderRadius: 10, width: '100%', minHeight: 50,
                textAlign: 'center', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 17,
                backgroundColor: PRIMARY, color: '#fff',
                border: `1.5px solid ${PRIMARY}`,
                marginTop: '0.25rem', padding: '0.6rem 1rem',
                transition: 'all 220ms cubic-bezier(.4,0,.6,1)',
                letterSpacing: '0.3px', boxSizing: 'border-box',
                boxShadow: `0 4px 14px rgba(235,168,75,0.35)`,
                opacity: loading ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  const b = e.currentTarget
                  b.style.backgroundColor = PRIMARY_HOVER_BG
                  b.style.color = PRIMARY
                  b.style.boxShadow = 'none'
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  const b = e.currentTarget
                  b.style.backgroundColor = PRIMARY
                  b.style.color = '#fff'
                  b.style.boxShadow = `0 4px 14px rgba(235,168,75,0.35)`
                }
              }}
            >
              {loading ? (
                <span style={{
                  width: 20, height: 20,
                  border: '2.5px solid rgba(255,255,255,0.35)',
                  borderTop: '2.5px solid #fff',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'spin 0.75s linear infinite',
                }} />
              ) : 'Sign in'}
            </button>

          </form>
        </div>
      </div>

      <style>{`
        @media (max-width: 575.98px) {
          .login-wrapper { width: 100% !important; padding: 0 1.2rem !important; }
        }
        @media (min-width: 576px) and (max-width: 767px) {
          .login-wrapper { width: 90% !important; }
        }
        @media (min-width: 768px) and (max-width: 991px) {
          .login-wrapper { width: 70% !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(30px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        input::placeholder { color: #a6a6a6; }
        input:focus { outline: none; }
      `}</style>
    </div>
  )
}
