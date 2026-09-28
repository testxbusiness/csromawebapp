import EventsManager from '@/components/admin/EventsManager'
import { AdminManagementPage } from '@/components/admin/AdminManagement'

export default function CalendarPage() {
  return (
    <AdminManagementPage title="Calendario" context="Sport" description="Pianifica e verifica gli eventi della società.">
      <EventsManager embedded />
    </AdminManagementPage>
  )
}
