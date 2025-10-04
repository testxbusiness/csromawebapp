'use client'

import UsersManager from '@/components/admin/UsersManager'
import PageHeader from '@/components/shared/PageHeader'

export default function UsersPage() {
  return (
    <>
      <PageHeader title="Gestione Utenti" subtitle="Amministrazione CSRoma" />
      <UsersManager />
    </>
  )
}
