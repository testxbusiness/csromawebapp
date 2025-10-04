'use client'

import GymsManager from '@/components/admin/GymsManager'
import PageHeader from '@/components/shared/PageHeader'

export default function GymsPage() {
  return (
    <>
      <PageHeader title="Gestione Palestre" subtitle="Amministrazione CSRoma" />
      <GymsManager />
    </>
  )
}
