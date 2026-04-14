'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCartStore } from '../../lib/store'
import { useRestaurant } from '../Providers'
import { apiGet, apiPost, setToken, getStoredToken } from '../../lib/api'
import {
  ORDER_TYPE,
  PAYMENT_METHOD,
  type OrderType,
  type PaymentMethod,
  type DeliveryAddress,
  type AuthResponse,
  type Customer,
} from '../../types'

const ARABIC_COUNTRIES = new Set(['EG', 'SA', 'AE', 'KW', 'QA', 'BH', 'OM', 'JO', 'LB', 'MA', 'TN', 'DZ', 'LY', 'SD', 'IQ', 'SY', 'YE', 'PS'])

type Step = 'auth' | 'otp' | 'order'

function getCurrency(country?: string): string {
  const map: Record<string, string> = {
    EG: 'EGP', SA: 'SAR', AE: 'AED', KW: 'KWD', QA: 'QAR', BH: 'BHD',
    OM: 'OMR', JO: 'JOD', LB: 'LBP', MA: 'MAD',
  }
  return map[(country ?? '').toUpperCase()] ?? 'EGP'
}

export default function CheckoutForm() {
  const config = useRestaurant()
  const router = useRouter()
  const items = useCartStore((s) => s.items)
  const subtotal = useCartStore((s) => s.subtotal())
  const restaurantId = useCartStore((s) => s.restaurantId)
  const franchiseId = useCartStore((s) => s.franchiseId)
  const clearCart = useCartStore((s) => s.clearCart)

  const isRtl = ARABIC_COUNTRIES.has((config.preferredCountry ?? '').toUpperCase())
  const currency = getCurrency(config.preferredCountry)

  // ── Auth state ─────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('auth')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSending, setOtpSending] = useState(false)
  const [otpVerifying, setOtpVerifying] = useState(false)

  // ── Order state ────────────────────────────────────────────────────────────
  const [orderType, setOrderType] = useState<OrderType>(ORDER_TYPE.TAKE_OUT)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PAYMENT_METHOD.CASH)
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null)
  const [promoCode, setPromoCode] = useState('')
  const [notes, setNotes] = useState('')
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── New address fields ──────────────────────────────────────────────────────
  const [showNewAddr, setShowNewAddr] = useState(false)
  const [newAddr, setNewAddr] = useState({ streetName: '', buildingNumber: '', area: '', lat: '', lng: '' })

  // Check if already logged in
  useEffect(() => {
    const token = getStoredToken()
    if (token) {
      apiGet<{ customer: Customer }>('/customer/profile')
        .then(({ customer }) => {
          setCustomer(customer)
          setStep('order')
        })
        .catch(() => setStep('auth'))
    }
  }, [])

  // Load addresses when on order step as delivery
  useEffect(() => {
    if (step === 'order' && orderType === ORDER_TYPE.DELIVERY) {
      apiGet<{ addresses: DeliveryAddress[] }>('/delivery/addresses')
        .then(({ addresses }) => {
          setAddresses(addresses)
          if (addresses.length > 0) setSelectedAddressId(addresses[0].id)
        })
        .catch(() => {})
    }
  }, [step, orderType])

  // ── OTP flow ───────────────────────────────────────────────────────────────
  async function sendOtp() {
    if (!phone.trim()) return
    setOtpSending(true)
    setError(null)
    try {
      await apiPost('/auth/otp', { phone: phone.trim(), type: 'LOGIN' })
      setStep('otp')
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setOtpSending(false)
    }
  }

  async function verifyOtp() {
    if (!otp.trim()) return
    setOtpVerifying(true)
    setError(null)
    try {
      const res = await apiPost<AuthResponse>('/auth/otp', { phone: phone.trim(), code: otp.trim() })
      setToken(res.token)
      setCustomer(res.customer)
      setStep('order')
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setOtpVerifying(false)
    }
  }

  // ── Save new address ───────────────────────────────────────────────────────
  async function saveNewAddress() {
    try {
      const { address } = await apiPost<{ address: DeliveryAddress }>('/delivery/address', {
        streetName: newAddr.streetName,
        buildingNumber: newAddr.buildingNumber,
        area: newAddr.area,
        lat: newAddr.lat ? Number(newAddr.lat) : undefined,
        lng: newAddr.lng ? Number(newAddr.lng) : undefined,
      })
      setAddresses((prev) => [...prev, address])
      setSelectedAddressId(address.id)
      setShowNewAddr(false)
    } catch (e: unknown) {
      setError((e as Error).message)
    }
  }

  // ── Place order ────────────────────────────────────────────────────────────
  async function placeOrder() {
    if (!restaurantId || !franchiseId) {
      setError('Missing restaurant context. Please reload.')
      return
    }
    if (orderType === ORDER_TYPE.DELIVERY && !selectedAddressId) {
      setError(isRtl ? 'يرجى تحديد عنوان التوصيل' : 'Please select a delivery address')
      return
    }
    if (items.length === 0) {
      setError(isRtl ? 'السلة فارغة' : 'Your cart is empty')
      return
    }

    setPlacing(true)
    setError(null)

    try {
      const cartItems = items.map((item) => ({
        itemId: item.itemId,
        name: item.name,
        nameArabic: item.nameArabic,
        price: item.price,
        quantity: item.quantity,
        addons: item.addons.map((a) => ({
          name: a.name,
          nameArabic: a.nameArabic,
          price: a.price,
          quantity: 1,
        })),
        notes: item.notes,
      }))

      const body: Record<string, unknown> = {
        restaurantId,
        franchiseId,
        orderType,
        paymentMethod,
        items: cartItems,
        notes: notes || undefined,
        promoCode: promoCode.trim() || undefined,
        deliveryFee: 0,
        discount: 0,
        pointsToRedeem: 0,
      }

      if (orderType === ORDER_TYPE.DELIVERY && selectedAddressId) {
        body.addressId = selectedAddressId
      }

      const { receipt } = await apiPost<{ receipt: { id: string } }>('/receipt/confirm', body)
      clearCart()
      router.push(`/order/${receipt.id}`)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setPlacing(false)
    }
  }

  const t = (ar: string, en: string) => isRtl ? ar : en

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px 120px' }}>
      <h1 style={{ fontWeight: 700, fontSize: '1.4rem', marginBottom: 24 }}>
        {t('إتمام الطلب', 'Checkout')}
      </h1>

      {/* ── Step: Phone ─────────────────────────────────────────────────────── */}
      {step === 'auth' && (
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontWeight: 700, marginBottom: 4 }}>{t('تسجيل الدخول', 'Sign in')}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 20 }}>
            {t('أدخل رقم هاتفك للمتابعة', 'Enter your phone number to continue')}
          </p>
          <input
            className="input"
            type="tel"
            placeholder={t('رقم الهاتف (مثال: 01012345678)', 'Phone number (e.g. 01012345678)')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendOtp()}
            dir="ltr"
            style={{ marginBottom: 12 }}
          />
          {error && <p style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: 8 }}>{error}</p>}
          <button
            className="btn-primary"
            style={{ width: '100%' }}
            onClick={sendOtp}
            disabled={otpSending || !phone.trim()}
          >
            {otpSending ? <span className="spinner" /> : t('إرسال رمز التحقق', 'Send OTP')}
          </button>
        </div>
      )}

      {/* ── Step: OTP ───────────────────────────────────────────────────────── */}
      {step === 'otp' && (
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontWeight: 700, marginBottom: 4 }}>{t('رمز التحقق', 'Verify OTP')}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 20 }}>
            {t(`أُرسل رمز إلى ${phone}`, `Code sent to ${phone}`)}
          </p>
          <input
            className="input"
            type="text"
            inputMode="numeric"
            placeholder={t('أدخل الرمز', 'Enter code')}
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && verifyOtp()}
            dir="ltr"
            style={{ marginBottom: 12, letterSpacing: '0.3em', textAlign: 'center', fontSize: '1.4rem' }}
          />
          {error && <p style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: 8 }}>{error}</p>}
          <button
            className="btn-primary"
            style={{ width: '100%', marginBottom: 10 }}
            onClick={verifyOtp}
            disabled={otpVerifying || !otp.trim()}
          >
            {otpVerifying ? <span className="spinner" /> : t('تحقق', 'Verify')}
          </button>
          <button
            style={{ width: '100%', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}
            onClick={() => { setStep('auth'); setOtp(''); setError(null) }}
          >
            {t('تغيير رقم الهاتف', 'Change phone number')}
          </button>
        </div>
      )}

      {/* ── Step: Order ─────────────────────────────────────────────────────── */}
      {step === 'order' && (
        <>
          {/* Order type */}
          <Section title={t('نوع الطلب', 'Order type')}>
            <div style={{ display: 'flex', gap: 10 }}>
              {([ORDER_TYPE.DELIVERY, ORDER_TYPE.TAKE_OUT] as OrderType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setOrderType(type)}
                  style={{
                    flex: 1,
                    padding: '12px 8px',
                    borderRadius: 10,
                    border: orderType === type ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                    background: orderType === type ? 'rgba(232,93,4,.06)' : 'transparent',
                    fontWeight: orderType === type ? 700 : 400,
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  {type === ORDER_TYPE.DELIVERY ? t('توصيل 🛵', 'Delivery 🛵') : t('استلام 🏃', 'Take out 🏃')}
                </button>
              ))}
            </div>
          </Section>

          {/* Delivery address */}
          {orderType === ORDER_TYPE.DELIVERY && (
            <Section title={t('عنوان التوصيل', 'Delivery address')}>
              {addresses.map((addr) => (
                <button
                  key={addr.id}
                  onClick={() => setSelectedAddressId(addr.id)}
                  style={{
                    width: '100%',
                    textAlign: isRtl ? 'right' : 'left',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: selectedAddressId === addr.id ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                    background: 'transparent',
                    marginBottom: 8,
                    cursor: 'pointer',
                  }}
                >
                  <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{addr.address_title ?? addr.address_line ?? `Address ${addr.id}`}</p>
                  {addr.area && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{addr.area}</p>}
                </button>
              ))}

              {showNewAddr ? (
                <div style={{ border: '1.5px solid var(--border)', borderRadius: 10, padding: 14, marginTop: 8 }}>
                  <p style={{ fontWeight: 600, marginBottom: 10 }}>{t('عنوان جديد', 'New address')}</p>
                  {[
                    { key: 'streetName', label: t('الشارع', 'Street name') },
                    { key: 'buildingNumber', label: t('رقم المبنى', 'Building number') },
                    { key: 'area', label: t('المنطقة', 'Area') },
                  ].map(({ key, label }) => (
                    <input
                      key={key}
                      className="input"
                      placeholder={label}
                      value={newAddr[key as keyof typeof newAddr]}
                      onChange={(e) => setNewAddr((p) => ({ ...p, [key]: e.target.value }))}
                      style={{ marginBottom: 8 }}
                    />
                  ))}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-primary" onClick={saveNewAddress} style={{ flex: 1, padding: '0.55rem' }}>
                      {t('حفظ', 'Save')}
                    </button>
                    <button className="btn-outline" onClick={() => setShowNewAddr(false)} style={{ flex: 1, padding: '0.55rem' }}>
                      {t('إلغاء', 'Cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewAddr(true)}
                  style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1.5px dashed var(--border)', background: 'none', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600, fontSize: '0.9rem' }}
                >
                  + {t('إضافة عنوان', 'Add address')}
                </button>
              )}
            </Section>
          )}

          {/* Payment method */}
          <Section title={t('طريقة الدفع', 'Payment method')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { value: PAYMENT_METHOD.CASH, label: t('نقدي 💵', 'Cash 💵') },
                { value: PAYMENT_METHOD.CARD_ON_DELIVERY, label: t('بطاقة عند الاستلام 💳', 'Card on delivery 💳') },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setPaymentMethod(value as PaymentMethod)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: paymentMethod === value ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                    background: paymentMethod === value ? 'rgba(232,93,4,.06)' : 'transparent',
                    fontWeight: paymentMethod === value ? 700 : 400,
                    cursor: 'pointer',
                    textAlign: isRtl ? 'right' : 'left',
                    fontSize: '0.9rem',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </Section>

          {/* Promo code */}
          <Section title={t('كود الخصم (اختياري)', 'Promo code (optional)')}>
            <input
              className="input"
              placeholder={t('أدخل الكود', 'Enter promo code')}
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              dir="ltr"
            />
          </Section>

          {/* Notes */}
          <Section title={t('ملاحظات (اختياري)', 'Notes (optional)')}>
            <textarea
              className="input"
              rows={2}
              placeholder={t('أي طلبات خاصة؟', 'Any special requests?')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ resize: 'none' }}
            />
          </Section>

          {/* Order summary */}
          <div className="card" style={{ padding: 20, marginTop: 8 }}>
            <h3 style={{ fontWeight: 700, marginBottom: 14 }}>{t('ملخص الطلب', 'Order summary')}</h3>
            {items.map((item) => {
              const name = isRtl && item.nameArabic ? item.nameArabic : item.name
              const addonsTotal = item.addons.reduce((s, a) => s + a.price, 0)
              return (
                <div key={item.cartId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.9rem' }}>
                  <span>{item.quantity}× {name}</span>
                  <span>{((item.price + addonsTotal) * item.quantity).toFixed(2)} {currency}</span>
                </div>
              )
            })}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>{t('الإجمالي', 'Total')}</span>
              <span>{subtotal.toFixed(2)} {currency}</span>
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: '#fee2e2', borderRadius: 10, color: '#dc2626', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <button
            className="btn-primary"
            style={{ width: '100%', marginTop: 20, padding: '1rem' }}
            onClick={placeOrder}
            disabled={placing}
          >
            {placing
              ? <span className="spinner" />
              : `${t('تأكيد الطلب', 'Place order')} · ${subtotal.toFixed(2)} ${currency}`}
          </button>
        </>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 20, marginBottom: 12 }}>
      <h3 style={{ fontWeight: 700, marginBottom: 14 }}>{title}</h3>
      {children}
    </div>
  )
}
