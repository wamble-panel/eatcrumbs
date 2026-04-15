'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashLayout from '../../components/DashLayout'
import { adminGet, adminPost } from '../../lib/api'

interface Customer {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  created_at: string
  totalOrders?: number
  totalSpend?: number
}

export default function CustomersPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const PAGE_SIZE = 20

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [listRes, pagesRes] = await Promise.all([
        adminGet<{ customers: Customer[]; total: number }>(`/customers/list?page=${page}&pageSize=${PAGE_SIZE}${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''}`),
        adminPost<{ total: number; pages: number }>('/customerprofiles/pagination', { search: debouncedSearch || undefined, pageSize: PAGE_SIZE }),
      ])
      setCustomers(listRes.customers)
      setTotal(listRes.total)
      setTotalPages(pagesRes.pages)
    } catch { /* silently fail */ }
    finally { setLoading(false) }
  }, [page, debouncedSearch])

  useEffect(() => { load() }, [load])

  return (
    <DashLayout pageTitle="Customers">
      <div style={{ padding: '24px 24px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <h1 style={{ fontWeight: 800, fontSize: '1.4rem' }}>Customers</h1>
          <span style={{ fontSize: '.875rem', color: 'var(--text-muted)' }}>{total.toLocaleString()} total</span>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', maxWidth: 420, marginBottom: 20 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="input"
            style={{ paddingLeft: 36 }}
            placeholder="Search by name or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem' }}>✕</button>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
        ) : customers.length === 0 ? (
          <div className="card" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p>{debouncedSearch ? `No customers found for "${debouncedSearch}"` : 'No customers yet.'}</p>
          </div>
        ) : (
          <>
            <div className="card" style={{ padding: '0 0 4px' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Joined</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(c => (
                    <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/customers/${c.id}`)}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: 'var(--primary)', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: '.8rem', flexShrink: 0,
                          }}>
                            {(c.name ?? '?')[0].toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600 }}>{c.name ?? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No name</span>}</span>
                        </div>
                      </td>
                      <td style={{ direction: 'ltr', color: 'var(--text-muted)', fontSize: '.85rem' }}>{c.phone ?? '—'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>{c.email ?? '—'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>
                        {new Date(c.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td>
                        <span style={{ color: 'var(--primary)', fontSize: '.8rem', fontWeight: 600 }}>View →</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 }}>
                <button className="btn btn-ghost" style={{ fontSize: '.8rem' }} disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                <span style={{ fontSize: '.875rem', color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
                <button className="btn btn-ghost" style={{ fontSize: '.8rem' }} disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    </DashLayout>
  )
}
