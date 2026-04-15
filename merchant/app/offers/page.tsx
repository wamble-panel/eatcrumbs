'use client'

import { useState, useEffect } from 'react'
import DashLayout from '../../components/DashLayout'
import { adminGet, adminPost } from '../../lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PromoCode {
  id: number
  code: string
  promoType: 'percentage' | 'fixed' | 'free_delivery'
  value: number
  minOrder: number
  maxUses: number | null
  perCustomer: boolean
  isActive: boolean
  expiresAt: string | null
  usageCount?: number
}

interface LoyaltySystem {
  id?: number
  pointsPerUnit: number
  minimumSpend: number
  redeemValue: number
  pointsRequiredToRedeem: number
  expiryDays: number | null
  isActive: boolean
}

interface MenuOffer {
  id: number
  franchiseId: number
  name: string
  nameArabic: string | null
  price: number
  imageUrl: string | null
  isActive: boolean
  sortOrder: number
}

// ── Promo Codes Tab ───────────────────────────────────────────────────────────

function PromoTab() {
  const [promos, setPromos] = useState<PromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<Partial<PromoCode> | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<PromoCode | null>(null)

  useEffect(() => { loadPromos() }, [])

  async function loadPromos() {
    setLoading(true)
    try {
      const data = await adminGet<{ promoCodes: PromoCode[] }>('/promo/list')
      setPromos(data.promoCodes)
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  async function savePromo() {
    if (!modal) return
    setSaving(true)
    try {
      const path = modal.id ? '/promo/edit' : '/promo/create'
      await adminPost(path, {
        ...modal,
        value: Number(modal.value),
        minOrder: Number(modal.minOrder ?? 0),
        maxUses: modal.maxUses ? Number(modal.maxUses) : null,
      })
      await loadPromos()
      setModal(null)
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setSaving(false) }
  }

  async function deletePromo(id: number) {
    try {
      await adminPost('/promo/delete', { id })
      setPromos(prev => prev.filter(p => p.id !== id))
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setConfirmDelete(null) }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: '.82rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>Promo Codes</p>
        <button className="btn btn-primary" style={{ fontSize: '.8rem' }} onClick={() => setModal({ promoType: 'percentage', value: 10, minOrder: 0, perCustomer: false, isActive: true })}>
          + Add promo code
        </button>
      </div>

      {error && <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: '.8rem' }}>{error}<button onClick={() => setError(null)} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>✕</button></div>}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>
      ) : promos.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <p>No promo codes yet. Create your first one to start offering discounts.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: '0 0 4px' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Type</th>
                <th>Value</th>
                <th>Min Order</th>
                <th>Status</th>
                <th>Expires</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {promos.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 700, fontFamily: 'monospace', letterSpacing: '.05em' }}>{p.code}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>{p.promoType.replace(/_/g, ' ')}</td>
                  <td style={{ fontWeight: 600 }}>
                    {p.promoType === 'percentage' ? `${p.value}%` : p.promoType === 'fixed' ? p.value.toFixed(2) : 'Free delivery'}
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{p.minOrder > 0 ? p.minOrder.toFixed(2) : '—'}</td>
                  <td>
                    <span className={`badge ${p.isActive ? 'badge-ready' : 'badge-cancelled'}`}>
                      {p.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>
                    {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost" style={{ padding: '.2rem .5rem', fontSize: '.75rem' }} onClick={() => setModal(p)}>Edit</button>
                      <button className="btn btn-ghost" style={{ padding: '.2rem .5rem', fontSize: '.75rem', color: '#ef4444' }} onClick={() => setConfirmDelete(p)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Promo Modal */}
      {modal !== null && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontWeight: 700 }}>{modal.id ? 'Edit promo code' : 'New promo code'}</h2>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-muted)' }}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="field">
                <label>Code</label>
                <input className="input" placeholder="SUMMER20" value={modal.code ?? ''} onChange={e => setModal(m => ({ ...m!, code: e.target.value.toUpperCase() }))} />
              </div>
              <div className="field">
                <label>Type</label>
                <select className="input" value={modal.promoType ?? 'percentage'} onChange={e => setModal(m => ({ ...m!, promoType: e.target.value as PromoCode['promoType'] }))}>
                  <option value="percentage">Percentage discount</option>
                  <option value="fixed">Fixed amount</option>
                  <option value="free_delivery">Free delivery</option>
                </select>
              </div>
              {modal.promoType !== 'free_delivery' && (
                <div className="field">
                  <label>{modal.promoType === 'percentage' ? 'Discount %' : 'Amount'}</label>
                  <input className="input" type="number" min={0} value={modal.value ?? ''} onChange={e => setModal(m => ({ ...m!, value: Number(e.target.value) }))} />
                </div>
              )}
              <div className="field">
                <label>Min order value</label>
                <input className="input" type="number" min={0} value={modal.minOrder ?? ''} onChange={e => setModal(m => ({ ...m!, minOrder: Number(e.target.value) }))} />
              </div>
              <div className="field">
                <label>Max uses (leave blank for unlimited)</label>
                <input className="input" type="number" min={1} value={modal.maxUses ?? ''} onChange={e => setModal(m => ({ ...m!, maxUses: e.target.value ? Number(e.target.value) : null }))} />
              </div>
              <div className="field">
                <label>Expires at (leave blank for no expiry)</label>
                <input className="input" type="date" value={modal.expiresAt ? modal.expiresAt.slice(0, 10) : ''} onChange={e => setModal(m => ({ ...m!, expiresAt: e.target.value || null }))} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label className="toggle">
                  <input type="checkbox" checked={modal.isActive ?? true} onChange={e => setModal(m => ({ ...m!, isActive: e.target.checked }))} />
                  <span className="toggle-track" />
                </label>
                <span style={{ fontSize: '.875rem' }}>Active</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={saving || !modal.code} onClick={savePromo}>
                {saving ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2 style={{ fontWeight: 700 }}>Delete promo code</h2></div>
            <div className="modal-body"><p>Delete <strong>{confirmDelete.code}</strong>? This cannot be undone.</p></div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => deletePromo(confirmDelete.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Loyalty Tab ───────────────────────────────────────────────────────────────

function LoyaltyTab() {
  const [system, setSystem] = useState<LoyaltySystem | null>(null)
  const [form, setForm] = useState<LoyaltySystem>({ pointsPerUnit: 1, minimumSpend: 0, redeemValue: 1, pointsRequiredToRedeem: 100, expiryDays: null, isActive: false })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    adminGet<{ pointingSystem: LoyaltySystem }>('/loyalty/pointing-system')
      .then(({ pointingSystem }) => {
        if (pointingSystem) {
          setSystem(pointingSystem)
          setForm(pointingSystem)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await adminPost('/loyalty/pointing-system', form)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setSaving(false) }
  }

  const F = (k: keyof LoyaltySystem, label: string, hint?: string) => (
    <div className="field">
      <label>{label}{hint && <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>({hint})</span>}</label>
      <input
        className="input"
        type="number"
        min={0}
        step={k === 'redeemValue' ? '0.01' : '1'}
        value={(form[k] as number) ?? ''}
        onChange={e => setForm(f => ({ ...f, [k]: Number(e.target.value) }))}
      />
    </div>
  )

  return (
    <div>
      <p style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: '.82rem', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 16 }}>Loyalty / Points System</p>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>
      ) : (
        <div className="card" style={{ padding: 24, maxWidth: 520 }}>
          {error && <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '.8rem' }}>{error}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {F('pointsPerUnit', 'Points earned per 1 unit spent')}
            {F('minimumSpend', 'Min spend to earn points')}
            {F('pointsRequiredToRedeem', 'Points required to redeem')}
            {F('redeemValue', 'Redeem value (currency)', 'per redemption')}
            <div className="field">
              <label>Points expiry <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(days, blank = never)</span></label>
              <input
                className="input"
                type="number"
                min={1}
                value={form.expiryDays ?? ''}
                onChange={e => setForm(f => ({ ...f, expiryDays: e.target.value ? Number(e.target.value) : null }))}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <label className="toggle">
              <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
              <span className="toggle-track" />
            </label>
            <span style={{ fontSize: '.875rem' }}>Loyalty program active</span>
          </div>

          {system && (
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '.8rem', color: 'var(--text-muted)' }}>
              Example: A customer spending <strong>100</strong> earns <strong>{form.pointsPerUnit * 100}</strong> points. Redeeming <strong>{form.pointsRequiredToRedeem}</strong> points gives <strong>{form.redeemValue}</strong> off.
            </div>
          )}

          <button className="btn btn-primary" disabled={saving} onClick={save} style={{ minWidth: 120 }}>
            {saving ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : saved ? '✓ Saved' : 'Save settings'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Menu Offers Tab ───────────────────────────────────────────────────────────

function MenuOffersTab() {
  const [offers, setOffers] = useState<MenuOffer[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<Partial<MenuOffer> | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [franchises, setFranchises] = useState<{ id: number; name: string }[]>([])

  useEffect(() => {
    Promise.all([
      adminGet<{ offers: MenuOffer[] }>('/offers/list'),
      adminGet<{ restaurant: object; franchises: { id: number; name: string }[] }>('/info'),
    ]).then(([o, info]) => {
      setOffers(o.offers)
      setFranchises(info.franchises)
    }).catch(() => {})
    .finally(() => setLoading(false))
  }, [])

  async function saveOffer() {
    if (!modal) return
    setSaving(true)
    try {
      await adminPost('/offers/save', {
        ...modal,
        price: Number(modal.price ?? 0),
        sortOrder: Number(modal.sortOrder ?? 0),
      })
      const data = await adminGet<{ offers: MenuOffer[] }>('/offers/list')
      setOffers(data.offers)
      setModal(null)
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setSaving(false) }
  }

  async function deleteOffer(id: number) {
    try {
      await adminPost('/offers/delete', { id })
      setOffers(prev => prev.filter(o => o.id !== id))
    } catch (e: unknown) { setError((e as Error).message) }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: '.82rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>Menu Offers</p>
        <button className="btn btn-primary" style={{ fontSize: '.8rem' }} onClick={() => setModal({ isActive: true, sortOrder: 0, price: 0 })}>
          + Add offer
        </button>
      </div>

      {error && <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: '.8rem' }}>{error}<button onClick={() => setError(null)} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>✕</button></div>}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>
      ) : offers.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <p>No menu offers yet.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {offers.map(o => (
            <div key={o.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: '.9rem', marginBottom: 2 }}>{o.name}</p>
                  {o.nameArabic && <p style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>{o.nameArabic}</p>}
                  <p style={{ fontWeight: 700, color: 'var(--primary)', marginTop: 6, fontSize: '.95rem' }}>{Number(o.price).toFixed(2)}</p>
                  <span className={`badge ${o.isActive ? 'badge-ready' : 'badge-cancelled'}`} style={{ marginTop: 6 }}>
                    {o.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                <button className="btn btn-ghost" style={{ flex: 1, fontSize: '.75rem', padding: '.25rem' }} onClick={() => setModal(o)}>Edit</button>
                <button className="btn btn-ghost" style={{ flex: 1, fontSize: '.75rem', padding: '.25rem', color: '#ef4444' }} onClick={() => deleteOffer(o.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontWeight: 700 }}>{modal.id ? 'Edit offer' : 'New offer'}</h2>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-muted)' }}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="field">
                <label>Name (English)</label>
                <input className="input" value={modal.name ?? ''} onChange={e => setModal(m => ({ ...m!, name: e.target.value }))} />
              </div>
              <div className="field">
                <label>Name (Arabic)</label>
                <input className="input" dir="rtl" value={modal.nameArabic ?? ''} onChange={e => setModal(m => ({ ...m!, nameArabic: e.target.value }))} />
              </div>
              <div className="field">
                <label>Price</label>
                <input className="input" type="number" min={0} step="0.01" value={modal.price ?? ''} onChange={e => setModal(m => ({ ...m!, price: Number(e.target.value) }))} />
              </div>
              {franchises.length > 0 && (
                <div className="field">
                  <label>Branch</label>
                  <select className="input" value={modal.franchiseId ?? ''} onChange={e => setModal(m => ({ ...m!, franchiseId: Number(e.target.value) }))}>
                    <option value="">Select branch</option>
                    {franchises.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label className="toggle">
                  <input type="checkbox" checked={modal.isActive ?? true} onChange={e => setModal(m => ({ ...m!, isActive: e.target.checked }))} />
                  <span className="toggle-track" />
                </label>
                <span style={{ fontSize: '.875rem' }}>Active</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={saving || !modal.name} onClick={saveOffer}>
                {saving ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OffersPage() {
  const [tab, setTab] = useState<'promos' | 'loyalty' | 'menu'>('promos')

  const tabs = [
    { key: 'promos', label: 'Promo Codes' },
    { key: 'loyalty', label: 'Loyalty / Points' },
    { key: 'menu', label: 'Menu Offers' },
  ] as const

  return (
    <DashLayout pageTitle="Offers">
      <div style={{ padding: '24px 24px 40px' }}>
        <h1 style={{ fontWeight: 800, fontSize: '1.4rem', marginBottom: 20 }}>Offers</h1>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid var(--border)', paddingBottom: 0 }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '8px 16px', fontSize: '.875rem', fontWeight: tab === t.key ? 700 : 500,
                color: tab === t.key ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: `2px solid ${tab === t.key ? 'var(--primary)' : 'transparent'}`,
                marginBottom: -2, transition: 'all .15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'promos' && <PromoTab />}
        {tab === 'loyalty' && <LoyaltyTab />}
        {tab === 'menu' && <MenuOffersTab />}
      </div>
    </DashLayout>
  )
}
