'use client'

import MessagesManager from '@/components/admin/MessagesManager'
import PageHeader from '@/components/shared/PageHeader'

export default function MessagesPage() {
  return (
    <>
      <PageHeader title="Gestione Messaggi" subtitle="Amministrazione CSRoma" />
      <MessagesManager />
    </>
  )
}
