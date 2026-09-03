'use client'

import TeamsManager from '@/components/admin/TeamsManager'
import { AdminManagementPage } from '@/components/admin/AdminManagement'

export default function TeamsPage() {
  return (
    <AdminManagementPage title="Squadre" context="Sport" description="Organizza le squadre, le attività e gli allenatori.">
      <TeamsManager embedded />
    </AdminManagementPage>
  )
}
