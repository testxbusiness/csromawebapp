'use client'

import DocumentsManager from '@/components/admin/DocumentsManager'
import { AdminManagementPage } from '@/components/admin/AdminManagement'

export default function DocumentsPage() {
  return (
    <AdminManagementPage title="Documenti" context="Comunicazione" description="Gestisci template, documenti generati e allegati alle comunicazioni.">
      <DocumentsManager embedded />
    </AdminManagementPage>
  )
}
