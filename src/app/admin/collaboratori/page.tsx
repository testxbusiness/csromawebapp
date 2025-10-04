'use client'

import { Suspense } from 'react'
import CoachesManager from '@/components/admin/CoachesManager'
import PageHeader from '@/components/shared/PageHeader'

export default function CollaboratoriPage() {
  return (
      <>
        <PageHeader title="Gestione Collaboratori" subtitle="Amministrazione CSRoma" />
        <Suspense fallback={<div className="text-center py-12">Caricamento gestione collaboratori...</div>}>
          <CoachesManager />
        </Suspense>
      </>
  )
}