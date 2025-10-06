'use client'

import PageHeader from '@/components/shared/PageHeader'
import AthleteCalendarManager from '@/components/athlete/AthleteCalendarManager'

export default function AthleteCalendarPage() {
  return (
    <>
      <PageHeader title="Gestione Calendario" subtitle="Area Atleta" />
      <AthleteCalendarManager />
    </>
  )
}
