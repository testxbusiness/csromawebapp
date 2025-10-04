import UserProfile from '@/components/shared/UserProfile'
import PageHeader from '@/components/shared/PageHeader'

export default function AdminProfilePage() {
  return (
    <>
      <PageHeader title="Il mio profilo" subtitle="Amministrazione CSRoma" />
      <UserProfile userRole="admin" />
    </>
  )
}