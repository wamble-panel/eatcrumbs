import { serverGet } from '../../../lib/server-api'
import OrderTracker from '../../../components/order/OrderTracker'
import type { Receipt, RestaurantConfig } from '../../../types'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Order status' }

interface Props {
  params: { id: string }
}

export default async function OrderPage({ params }: Props) {
  let receipt: Receipt | null = null
  let preferredCountry: string | undefined

  try {
    const [{ receipt: r }, { config }] = await Promise.all([
      serverGet<{ receipt: Receipt }>(`/receipt/latest-receipt/${params.id}`),
      serverGet<{ config: RestaurantConfig }>('/config'),
    ])
    receipt = r
    preferredCountry = config.preferredCountry
  } catch {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <p style={{ color: 'var(--text-muted)' }}>Order not found.</p>
        <a href="/" style={{ color: 'var(--primary)', fontWeight: 600 }}>
          ← Back to menu
        </a>
      </div>
    )
  }

  if (!receipt) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{ color: 'var(--text-muted)' }}>Order not found.</p>
      </div>
    )
  }

  return (
    <div>
      <header
        style={{
          height: 'var(--header-h)',
          background: 'var(--card-bg)',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
        }}
      >
        <a
          href="/"
          style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}
        >
          ← Menu
        </a>
      </header>
      <OrderTracker initialReceipt={receipt} preferredCountry={preferredCountry} />
    </div>
  )
}
