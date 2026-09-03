'use client'

import SeasonsManager from '@/components/admin/SeasonsManager'
import { AdminManagementPage } from '@/components/admin/AdminManagement'

export default function SeasonsPage() {
  return (
    <AdminManagementPage title="Stagioni" context="Sport" description="Configura i periodi sportivi e la stagione attiva.">
      <SeasonsManager embedded />
    </AdminManagementPage>
  )
}
