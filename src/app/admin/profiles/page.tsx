import PeopleManager from '@/components/admin/PeopleManager'
import PageHeader from '@/components/shared/PageHeader'

export default function ProfilesPage() {
  return (
    <>
      <PageHeader title="Persone" subtitle="Anagrafica e ciclo di vita degli accessi" />
      <PeopleManager />
    </>
  )
}
