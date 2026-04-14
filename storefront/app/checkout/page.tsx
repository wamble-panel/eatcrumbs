import CheckoutForm from '../../components/checkout/CheckoutForm'
import { serverGet } from '../../lib/server-api'
import type { RestaurantConfig } from '../../types'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Checkout' }

export default async function CheckoutPage() {
  // Fetch config purely for the back-link restaurant name
  let restaurantName = 'Restaurant'
  try {
    const { config } = await serverGet<{ config: RestaurantConfig }>('/config')
    restaurantName = config.name ?? restaurantName
  } catch {}

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
          gap: 12,
        }}
      >
        <a
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            color: 'var(--primary)',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '0.9rem',
          }}
        >
          ← {restaurantName}
        </a>
      </header>
      <CheckoutForm />
    </div>
  )
}
