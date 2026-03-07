'use client'

import PageHeader from '@/components/shared/PageHeader'
import AdminChampionshipsManager from '@/components/admin/AdminChampionshipsManager'

export default function ChampionshipsPage() {
  return (
    <>
      <PageHeader
        title="Campionati"
        subtitle="Gestisci struttura, calendari, risultati e sincronizzazione del campionato"
      />
      <AdminChampionshipsManager />
    </>
  )
}
