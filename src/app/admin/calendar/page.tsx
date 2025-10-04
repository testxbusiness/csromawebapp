'use client'

import EventsManager from '@/components/admin/EventsManager'
import PageHeader from '@/components/shared/PageHeader'

export default function CalendarPage() {
  return (
    <>
      <PageHeader title="Gestione Calendario" subtitle="Amministrazione CSRoma" />
      <EventsManager />
    </>
  )
}
