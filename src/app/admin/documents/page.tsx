'use client'

import DocumentsManager from '@/components/admin/DocumentsManager'
import PageHeader from '@/components/shared/PageHeader'

export default function DocumentsPage() {
  return (
    <>
      <PageHeader title="Gestione Documenti" subtitle="Amministrazione CSRoma" />
      <DocumentsManager />
    </>
  )
}
