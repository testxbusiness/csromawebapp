'use client'

import SeasonsManager from '@/components/admin/SeasonsManager'
import PageHeader from '@/components/shared/PageHeader'

export default function SeasonsPage() {
  return (
    <>
      <PageHeader title="Gestione Stagioni" subtitle="Amministrazione CSRoma" />
      <SeasonsManager />
    </>
  )
}
