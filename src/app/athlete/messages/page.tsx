'use client'

import AthleteMessagesManager from '@/components/athlete/AthleteMessagesManager'
import PageHeader from '@/components/shared/PageHeader'

export default function AthleteMessagesPage() {
  return (
    <>
      <PageHeader title="Messaggi" subtitle="Area Atleta" />
      <AthleteMessagesManager />
    </>
  )
}
