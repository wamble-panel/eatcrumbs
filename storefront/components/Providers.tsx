'use client'

import { createContext, useContext, useEffect } from 'react'
import { useCartStore } from '../lib/store'
import type { RestaurantConfig } from '../types'

const RestaurantCtx = createContext<RestaurantConfig | null>(null)

export function useRestaurant(): RestaurantConfig {
  const ctx = useContext(RestaurantCtx)
  if (!ctx) throw new Error('useRestaurant must be used inside <Providers>')
  return ctx
}

interface Props {
  config: RestaurantConfig
  children: React.ReactNode
}

export default function Providers({ config, children }: Props) {
  const setContext = useCartStore((s) => s.setContext)

  useEffect(() => {
    if (config.restaurantId && config.franchiseId) {
      setContext(config.restaurantId, config.franchiseId)
    }
  }, [config.restaurantId, config.franchiseId, setContext])

  return (
    <RestaurantCtx.Provider value={config}>
      {children}
    </RestaurantCtx.Provider>
  )
}
