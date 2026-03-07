'use client'

import PageHeader from '@/components/shared/PageHeader'
import CoachChampionshipsManager from '@/components/coach/CoachChampionshipsManager'

export default function CoachChampionshipsPage() {
  return (
    <>
      <PageHeader title="Campionati" subtitle="Gestisci risultati, info gara, convocazioni e calendario delle tue squadre" />
      <CoachChampionshipsManager />
    </>
  )
}
