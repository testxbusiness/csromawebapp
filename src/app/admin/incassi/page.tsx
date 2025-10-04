'use client'

import InstallmentsManager from '@/components/admin/InstallmentsManager'
import PageHeader from '@/components/shared/PageHeader'

export default function IncassiPage() {
  return (
    <>
      <PageHeader
        title="Gestione Incassi"
        subtitle="Monitora e gestisci le rate delle quote associative"
      />
      <InstallmentsManager />
    </>
  )
}
