'use client'

import ActivitiesManager from '@/components/admin/ActivitiesManager'
import PageHeader from '@/components/shared/PageHeader'

export default function ActivitiesPage() {
  return (
    <>
      <PageHeader title="Gestione Attività Sportive" subtitle="Amministrazione CSRoma" />
      <ActivitiesManager />
    </>
  )
}
