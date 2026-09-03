'use client'

import ActivitiesManager from '@/components/admin/ActivitiesManager'
import { AdminManagementPage } from '@/components/admin/AdminManagement'

export default function ActivitiesPage() {
  return (
    <AdminManagementPage title="Attività sportive" context="Sport" description="Gestisci le discipline collegate alle stagioni.">
      <ActivitiesManager embedded />
    </AdminManagementPage>
  )
}
