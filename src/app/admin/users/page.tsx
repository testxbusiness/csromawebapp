'use client'

import UsersManager from '@/components/admin/UsersManager'
import { AdminManagementPage } from '@/components/admin/AdminManagement'

export default function UsersPage() {
  return (
    <AdminManagementPage title="Account e accessi" context="Persone" description="Gestisci identità, ruoli e stato degli account.">
      <UsersManager embedded />
    </AdminManagementPage>
  )
}
