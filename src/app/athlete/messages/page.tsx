import { Suspense } from 'react'
import AthleteMessagesManager from '@/components/athlete/AthleteMessagesManager'
import PageHeader from '@/components/shared/PageHeader'
import { LoadingState } from '@/components/ui'

export default function AthleteMessagesPage() {
  return (
    <>
      <PageHeader title="Messaggi" subtitle="Area Atleta" />
      <Suspense fallback={<LoadingState label="Caricamento messaggi..." />}>
        <AthleteMessagesManager />
      </Suspense>
    </>
  )
}
