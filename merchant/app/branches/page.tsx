'use client'

import DashLayout from '../../components/DashLayout'
import BranchList from '../../components/branches/BranchList'

export default function BranchesPage() {
  return (
    <DashLayout pageTitle="Branches">
      <div style={{ padding: '24px 24px 40px' }}>
        <BranchList />
      </div>
    </DashLayout>
  )
}
