'use client'

import MembershipFeesManager from '@/components/admin/MembershipFeesManager'
import PageHeader from '@/components/shared/PageHeader'

export default function MembershipFeesPage() {
  return (
    <>
      <PageHeader title="Gestione Quote Associative" subtitle="Amministrazione CSRoma" />
      <MembershipFeesManager />
    </>
  )
}
