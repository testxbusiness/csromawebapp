import AdminChampionshipsManager from '@/components/admin/AdminChampionshipsManager'
import { AdminManagementPage } from '@/components/admin/AdminManagement'

export default function ChampionshipsPage() {
  return (
    <AdminManagementPage title="Campionati" context="Sport" description="Gestisci struttura, calendari, risultati e sincronizzazione del campionato.">
      <AdminChampionshipsManager embedded />
    </AdminManagementPage>
  )
}
