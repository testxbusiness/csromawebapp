'use client'

import InstallmentsManager from '@/components/admin/InstallmentsManager'
import { AdminManagementPage } from '@/components/admin/AdminManagement'

export default function IncassiPage() {
  return (
    <AdminManagementPage title="Incassi" context="Amministrazione" description="Monitora rate, scadenze e incassi delle quote associative.">
      <InstallmentsManager />
    </AdminManagementPage>
  )
}
