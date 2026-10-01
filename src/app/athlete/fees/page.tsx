'use client'

import { Suspense } from 'react'
import AthleteAdministrationManager from '@/components/athlete/AthleteAdministrationManager'
import PageHeader from '@/components/shared/PageHeader'

export default function AthleteFeesPage() {
  return (
    <>
      <PageHeader title="Amministrazione" subtitle="Area Atleta" />
      <Suspense fallback={null}>
        <AthleteAdministrationManager />
      </Suspense>
    </>
  )
}
