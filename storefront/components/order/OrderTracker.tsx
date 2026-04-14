'use client'

import { useState, useEffect } from 'react'
import { getSupabaseClient } from '../../lib/supabase'
import { RECEIPT_STATE } from '../../types'
import type { Receipt } from '../../types'

const ARABIC_COUNTRIES = new Set(['EG', 'SA', 'AE', 'KW', 'QA', 'BH', 'OM', 'JO', 'LB', 'MA', 'TN', 'DZ', 'LY', 'SD', 'IQ', 'SY', 'YE', 'PS'])

type StateStep = {
  state: string
  labelEn: string
  labelAr: string
  icon: string
}

const STATE_STEPS: StateStep[] = [
  { state: RECEIPT_STATE.PENDING,              labelEn: 'Order received',    labelAr: 'تم استلام الطلب',    icon: '📋' },
  { state: RECEIPT_STATE.ACCEPTED,             labelEn: 'Preparing',         labelAr: 'جاري التحضير',       icon: '👨‍🍳' },
  { state: RECEIPT_STATE.READY,                labelEn: 'Ready',             labelAr: 'جاهز',               icon: '✅' },
  { state: RECEIPT_STATE.ON_WAY_TO_DELIVERY,   labelEn: 'On the way',        labelAr: 'في الطريق إليك',    icon: '🛵' },
  { state: RECEIPT_STATE.DELIVERED,            labelEn: 'Delivered',         labelAr: 'تم التوصيل',         icon: '🎉' },
]

const TAKEOUT_STEPS: StateStep[] = [
  { state: RECEIPT_STATE.PENDING,              labelEn: 'Order received',    labelAr: 'تم استلام الطلب',    icon: '📋' },
  { state: RECEIPT_STATE.ACCEPTED,             labelEn: 'Preparing',         labelAr: 'جاري التحضير',       icon: '👨‍🍳' },
  { state: RECEIPT_STATE.READY,                labelEn: 'Ready for pickup',  labelAr: 'جاهز للاستلام',      icon: '✅' },
  { state: RECEIPT_STATE.ON_WAY_TO_PICKUP,     labelEn: 'Picked up',         labelAr: 'تم الاستلام',        icon: '🎉' },
]

function stateIndex(steps: StateStep[], state: string): number {
  const idx = steps.findIndex((s) => s.state === state)
  return idx === -1 ? 0 : idx
}

function getStateLabel(state: string, isRtl: boolean): string {
  const found = [...STATE_STEPS, ...TAKEOUT_STEPS].find((s) => s.state === state)
  if (!found) return state
  return isRtl ? found.labelAr : found.labelEn
}

function getCurrency(country?: string): string {
  const map: Record<string, string> = {
    EG: 'EGP', SA: 'SAR', AE: 'AED', KW: 'KWD', QA: 'QAR', BH: 'BHD',
    OM: 'OMR', JO: 'JOD', LB: 'LBP', MA: 'MAD',
  }
  return map[(country ?? '').toUpperCase()] ?? 'EGP'
}

interface Props {
  initialReceipt: Receipt
  preferredCountry?: string
}

export default function OrderTracker({ initialReceipt, preferredCountry }: Props) {
  const [receipt, setReceipt] = useState<Receipt>(initialReceipt)
  const isRtl = ARABIC_COUNTRIES.has((preferredCountry ?? '').toUpperCase())
  const currency = getCurrency(preferredCountry)
  const isCancelled = receipt.state === RECEIPT_STATE.CANCELLED
  const isDelivery = receipt.order_type === 'DELIVERY' || receipt.order_type === 'DELIVERYV2'
  const steps = isDelivery ? STATE_STEPS : TAKEOUT_STEPS
  const activeIdx = stateIndex(steps, receipt.state)

  // Subscribe to Supabase Realtime for this receipt
  useEffect(() => {
    const supabase = getSupabaseClient()
    const channel = supabase
      .channel(`receipt-${receipt.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'receipts',
          filter: `id=eq.${receipt.id}`,
        },
        (payload) => {
          setReceipt((prev) => ({ ...prev, ...(payload.new as Partial<Receipt>) }))
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [receipt.id])

  const t = (ar: string, en: string) => isRtl ? ar : en

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 16px' }}>
      {/* Order number */}
      <div className="card" style={{ padding: 24, marginBottom: 16, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 4 }}>
          {t('رقم الطلب', 'Order number')}
        </p>
        <p style={{ fontWeight: 800, fontSize: '2rem', color: 'var(--primary)' }}>
          #{receipt.order_number}
        </p>
        {receipt.estimated_minutes && !isCancelled && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
            {t('الوقت المتوقع:', 'Estimated time:')} {receipt.estimated_minutes} {t('دقيقة', 'min')}
          </p>
        )}
      </div>

      {/* Cancelled banner */}
      {isCancelled && (
        <div style={{ background: '#fee2e2', borderRadius: 12, padding: '14px 20px', marginBottom: 16, textAlign: 'center' }}>
          <p style={{ color: '#dc2626', fontWeight: 700 }}>❌ {t('تم إلغاء الطلب', 'Order cancelled')}</p>
        </div>
      )}

      {/* Status steps */}
      {!isCancelled && (
        <div className="card" style={{ padding: 24, marginBottom: 16 }}>
          <h2 style={{ fontWeight: 700, marginBottom: 20 }}>{t('حالة الطلب', 'Order status')}</h2>
          {steps.map((step, idx) => {
            const isDone = idx <= activeIdx
            const isActive = idx === activeIdx
            return (
              <div
                key={step.state}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                  marginBottom: idx < steps.length - 1 ? 20 : 0,
                  opacity: isDone ? 1 : 0.35,
                }}
              >
                {/* Icon + line */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: isDone ? 'var(--primary)' : 'var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1rem',
                      transition: 'background 0.3s',
                    }}
                  >
                    {isDone ? step.icon : <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{idx + 1}</span>}
                  </div>
                  {idx < steps.length - 1 && (
                    <div
                      style={{
                        width: 2,
                        height: 24,
                        background: idx < activeIdx ? 'var(--primary)' : 'var(--border)',
                        marginTop: 4,
                        transition: 'background 0.3s',
                      }}
                    />
                  )}
                </div>

                {/* Label */}
                <div style={{ paddingTop: 6 }}>
                  <p style={{ fontWeight: isActive ? 700 : 500, fontSize: isActive ? '1rem' : '0.9rem' }}>
                    {isRtl ? step.labelAr : step.labelEn}
                  </p>
                  {isActive && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: 2 }}>
                      {t('الحالة الحالية', 'Current status')}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Payment status */}
      <div className="card" style={{ padding: 20, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)' }}>{t('الدفع', 'Payment')}</span>
          <span style={{ fontWeight: 600, color: receipt.is_paid ? '#16a34a' : 'var(--text)' }}>
            {receipt.is_paid ? t('✓ مدفوع', '✓ Paid') : t('عند الاستلام', 'On delivery')}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <span style={{ color: 'var(--text-muted)' }}>{t('الإجمالي', 'Total')}</span>
          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
            {receipt.total.toFixed(2)} {currency}
          </span>
        </div>
      </div>

      {/* Back to menu */}
      <a
        href="/"
        style={{
          display: 'block',
          textAlign: 'center',
          marginTop: 24,
          color: 'var(--primary)',
          fontWeight: 600,
          textDecoration: 'none',
          fontSize: '0.9rem',
        }}
      >
        {t('← العودة للقائمة', '← Back to menu')}
      </a>
    </div>
  )
}
