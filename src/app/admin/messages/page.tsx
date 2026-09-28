'use client'

import MessagesManager from '@/components/admin/MessagesManager'
import { AdminManagementPage } from '@/components/admin/AdminManagement'

export default function MessagesPage() {
  return (
    <AdminManagementPage title="Messaggi" context="Comunicazione" description="Crea, invia e monitora le comunicazioni verso squadre e utenti.">
      <MessagesManager embedded />
    </AdminManagementPage>
  )
}
