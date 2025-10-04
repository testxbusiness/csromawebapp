'use client'

import TeamsManager from '@/components/admin/TeamsManager'
import PageHeader from '@/components/shared/PageHeader'

export default function TeamsPage() {
  return (
    <>
      <PageHeader title="Gestione Squadre" subtitle="Amministrazione CSRoma" />
      <TeamsManager />
    </>
  )
}
