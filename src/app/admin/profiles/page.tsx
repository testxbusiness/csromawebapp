import PeopleManager from '@/components/admin/PeopleManager'
import { AdminManagementPage } from '@/components/admin/AdminManagement'

export default function ProfilesPage() {
  return (
    <AdminManagementPage title="Anagrafica" context="Persone" description="Gestisci persone, relazioni e ciclo di vita degli accessi.">
      <PeopleManager embedded />
    </AdminManagementPage>
  )
}
