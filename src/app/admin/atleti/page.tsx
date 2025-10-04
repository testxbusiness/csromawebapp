'use client'

import { Suspense } from 'react'
import AthletesManager from '@/components/admin/AthletesManager'
import PageHeader from '@/components/shared/PageHeader'

export default function AtletiPage() {
  return (
    <>
      <PageHeader title="Gestione Atleti" subtitle="Amministrazione CSRoma" />
      <Suspense fallback={<div className="text-center py-12">Caricamento gestione atleti...</div>}>
        <AthletesManager />
      </Suspense>
    </>
  )
}