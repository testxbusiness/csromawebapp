import { Suspense } from 'react'
import AthleteAdministrationManager from '@/components/athlete/AthleteAdministrationManager'
import PageHeader from '@/components/shared/PageHeader'
import { LoadingState } from '@/components/ui'

export default function AthleteFeesPage() {
  return (
    <>
      <PageHeader title="Amministrazione" subtitle="Area Atleta" />
      <Suspense fallback={<LoadingState label="Caricamento amministrazione..." />}>
        <AthleteAdministrationManager />
      </Suspense>
    </>
  )
}
