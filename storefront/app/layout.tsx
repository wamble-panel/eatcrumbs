import type { Metadata } from 'next'
import { serverGet } from '../lib/server-api'
import Providers from '../components/Providers'
import type { RestaurantConfig } from '../types'
import './globals.css'

const ARABIC_COUNTRIES = new Set(['EG', 'SA', 'AE', 'KW', 'QA', 'BH', 'OM', 'JO', 'LB', 'MA', 'TN', 'DZ', 'LY', 'SD', 'IQ', 'SY', 'YE', 'PS'])

export async function generateMetadata(): Promise<Metadata> {
  try {
    const data = await serverGet<{ config: RestaurantConfig }>('/config')
    const name = data.config.name ?? 'Restaurant'
    return { title: name, description: `Order online from ${name}` }
  } catch {
    return { title: 'Order Online' }
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let config: RestaurantConfig = {
    restaurantId: 0,
    franchiseId: null,
    name: 'Restaurant',
  }

  try {
    const data = await serverGet<{ config: RestaurantConfig }>('/config')
    if (data.config.restaurantId) config = data.config
  } catch {
    // serve with defaults; individual pages will handle missing restaurantId
  }

  const isRtl = ARABIC_COUNTRIES.has((config.preferredCountry ?? '').toUpperCase())
  const primaryColor = (config.primaryColor as string | undefined) ?? '#e85d04'
  const primaryDark = (config.primaryDark as string | undefined) ?? '#c24d00'

  return (
    <html lang={isRtl ? 'ar' : 'en'} dir={isRtl ? 'rtl' : 'ltr'}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style>{`
          :root {
            --primary: ${primaryColor};
            --primary-dark: ${primaryDark};
          }
        `}</style>
      </head>
      <body>
        <Providers config={config}>
          {children}
        </Providers>
      </body>
    </html>
  )
}
