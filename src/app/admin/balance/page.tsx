'use client'

import BalanceDashboard from '@/components/admin/BalanceDashboard'
import { AdminManagementPage } from '@/components/admin/AdminManagement'

export default function BalancePage() {
  return (
    <AdminManagementPage title="Bilancio" context="Amministrazione" description="Leggi consuntivo, previsioni e partite ancora da regolare.">
      <BalanceDashboard />
    </AdminManagementPage>
  )
}
