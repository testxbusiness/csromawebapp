'use client'

import { Suspense } from 'react'
import AthletesManager from '@/components/admin/AthletesManager'
import { AdminManagementPage } from '@/components/admin/AdminManagement'

export default function AtletiPage() {
  return (
    <AdminManagementPage title="Atleti" context="Persone" description="Gestisci iscrizioni, squadre e stato dei certificati.">
      <Suspense fallback={<div className="text-center py-12">Caricamento gestione atleti...</div>}>
        <AthletesManager embedded />
      </Suspense>
    </AdminManagementPage>
  )
}
