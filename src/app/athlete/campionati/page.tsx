'use client'

import PageHeader from '@/components/shared/PageHeader'
import AthleteChampionshipsManager from '@/components/athlete/AthleteChampionshipsManager'

export default function AthleteChampionshipsPage() {
  return (
    <>
      <PageHeader title="Campionati" subtitle="Risultati, classifiche e calendario partite" />
      <AthleteChampionshipsManager />
    </>
  )
}
