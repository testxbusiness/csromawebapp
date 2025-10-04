'use client'

import CoachMessagesManager from '@/components/coach/CoachMessagesManager'
import PageHeader from '@/components/shared/PageHeader'

export default function CoachMessagesPage() {
  return (
    <>
      <PageHeader title="Messaggi" subtitle="Area Allenatore" />
      <CoachMessagesManager />
    </>
  )
}
