'use client'

import PaymentsManager from '@/components/admin/PaymentsManager'
import { AdminManagementPage } from '@/components/admin/AdminManagement'

export default function PaymentsPage() {
  return (
    <AdminManagementPage title="Uscite" context="Amministrazione" description="Gestisci costi generali, compensi e pagamenti dello staff.">
      <PaymentsManager embedded />
    </AdminManagementPage>
  )
}
