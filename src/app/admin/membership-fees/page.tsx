'use client'

import MembershipFeesManager from '@/components/admin/MembershipFeesManager'
import { AdminManagementPage } from '@/components/admin/AdminManagement'

export default function MembershipFeesPage() {
  return (
    <AdminManagementPage title="Quote associative" context="Amministrazione" description="Configura piani, rate e stato delle quote per le squadre.">
      <MembershipFeesManager embedded />
    </AdminManagementPage>
  )
}
