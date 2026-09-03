'use client'

import GymsManager from '@/components/admin/GymsManager'
import { AdminManagementPage } from '@/components/admin/AdminManagement'

export default function GymsPage() {
  return (
    <AdminManagementPage title="Palestre" context="Sport" description="Gestisci gli impianti disponibili per le attività.">
      <GymsManager embedded />
    </AdminManagementPage>
  )
}
