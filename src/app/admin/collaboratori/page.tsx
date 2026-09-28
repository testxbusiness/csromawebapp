'use client'

import { Suspense } from 'react'
import CoachesManager from '@/components/admin/CoachesManager'
import { AdminManagementPage } from '@/components/admin/AdminManagement'

export default function CollaboratoriPage() {
  return (
      <AdminManagementPage title="Collaboratori" context="Persone" description="Gestisci collaboratori, assegnazioni e accessi.">
        <Suspense fallback={<div className="text-center py-12">Caricamento gestione collaboratori...</div>}>
          <CoachesManager embedded />
        </Suspense>
      </AdminManagementPage>
  )
}
