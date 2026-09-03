'use client'

import { Suspense } from 'react'
import CoachMessagesManager from '@/components/coach/CoachMessagesManager'
import PageHeader from '@/components/shared/PageHeader'
import { LoadingState } from '@/components/ui'

export default function CoachMessagesPage() {
  return (
    <>
      <PageHeader title="Messaggi" subtitle="Area Allenatore" />
      <Suspense fallback={<LoadingState label="Caricamento messaggi..." />}>
        <CoachMessagesManager />
      </Suspense>
    </>
  )
}
