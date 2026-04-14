'use client'

import DashLayout from '../../components/DashLayout'
import MenuManager from '../../components/menu/MenuManager'

export default function MenuPage() {
  return (
    <DashLayout pageTitle="Menu">
      <div style={{ padding: '24px 24px 40px' }}>
        <MenuManager />
      </div>
    </DashLayout>
  )
}
