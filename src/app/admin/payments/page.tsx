'use client'

import PaymentsManager from '@/components/admin/PaymentsManager'
import PageHeader from '@/components/shared/PageHeader'

export default function PaymentsPage() {
  return (
    <>
      <PageHeader title="Gestione Pagamenti" subtitle="Amministrazione CSRoma" />
      <PaymentsManager />
    </>
  )
}
