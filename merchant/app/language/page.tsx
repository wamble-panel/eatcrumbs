'use client'

import { useState, useEffect } from 'react'
import DashLayout from '../../components/DashLayout'

const LANGUAGES = [
  { code: 'en',    label: 'English',              dir: 'ltr' },
  { code: 'ar',    label: 'العربية',              dir: 'rtl' },
  { code: 'ar-SA', label: 'العربية (السعودية)',   dir: 'rtl' },
]

export default function LanguagePage() {
  const [current, setCurrent] = useState('en')

  useEffect(() => {
    const saved = localStorage.getItem('lang') ?? 'en'
    setCurrent(saved)
  }, [])

  function selectLang(code: string) {
    const lang = LANGUAGES.find(l => l.code === code)!
    setCurrent(code)
    localStorage.setItem('lang', code)
    document.documentElement.lang = code
    document.documentElement.dir = lang.dir
    document.body.dir = lang.dir
  }

  return (
    <DashLayout pageTitle="Language">
      <div style={{ padding: '24px 24px 40px', maxWidth: 480 }}>
        <h1 className="main-title" style={{ marginBottom: 8 }}>Language</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '.875rem', marginBottom: 28 }}>
          Language changes are applied immediately across the app.
        </p>

        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => selectLang(lang.code)}
                style={{
                  all: 'unset',
                  boxSizing: 'border-box',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 18px',
                  borderRadius: 'var(--radius-sm)',
                  border: `2px solid ${current === lang.code ? 'var(--primary)' : 'var(--border)'}`,
                  cursor: 'pointer',
                  background: current === lang.code ? 'var(--primary-bg)' : '#fff',
                  transition: 'all .15s',
                }}
              >
                {/* Radio circle */}
                <span style={{
                  width: 18, height: 18, borderRadius: '50%',
                  border: `2px solid ${current === lang.code ? 'var(--primary)' : 'var(--border)'}`,
                  background: current === lang.code ? 'var(--primary)' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {current === lang.code && (
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
                  )}
                </span>
                <span style={{
                  fontSize: 16,
                  fontWeight: current === lang.code ? 600 : 400,
                  color: current === lang.code ? 'var(--primary)' : 'var(--text)',
                  fontFamily: lang.dir === 'rtl' ? 'Almarai, sans-serif' : 'inherit',
                }}>
                  {lang.label}
                </span>
                {current === lang.code && (
                  <svg style={{ marginLeft: 'auto' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>

        <p style={{ marginTop: 20, fontSize: '.78rem', color: 'var(--text-muted)' }}>
          Arabic support uses the Almarai font and switches the page to right-to-left direction.
        </p>
      </div>
    </DashLayout>
  )
}
