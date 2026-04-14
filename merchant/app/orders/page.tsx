'use client'

import { useEffect, useState } from 'react'
import DashLayout from '../../components/DashLayout'
import OrdersBoard from '../../components/orders/OrdersBoard'
import { adminGet } from '../../lib/api'
import type { FranchiseInfo } from '../../types'

export default function OrdersPage() {
  const [franchises, setFranchises] = useState<FranchiseInfo[]>([])

  useEffect(() => {
    adminGet<{ restaurant: object; franchises: FranchiseInfo[] }>('/info')
      .then(({ franchises: f }) => setFranchises(f))
      .catch(() => {})
  }, [])

  return (
    <DashLayout pageTitle="Live orders">
      <OrdersBoard franchises={franchises} />
    </DashLayout>
  )
}
