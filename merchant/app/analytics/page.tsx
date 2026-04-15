'use client'

import { useEffect, useState } from 'react'
import DashLayout from '../../components/DashLayout'
import AnalyticsDashboard from '../../components/analytics/AnalyticsDashboard'
import { adminGet } from '../../lib/api'
import type { FranchiseInfo } from '../../types'

export default function AnalyticsPage() {
  const [franchises, setFranchises] = useState<FranchiseInfo[]>([])

  useEffect(() => {
    adminGet<{ restaurant: object; franchises: FranchiseInfo[] }>('/info')
      .then(({ franchises: f }) => setFranchises(f))
      .catch(() => {})
  }, [])

  return (
    <DashLayout pageTitle="Analytics">
      <div style={{ padding: '24px 24px 40px' }}>
        <AnalyticsDashboard franchises={franchises} />
      </div>
    </DashLayout>
  )
}
