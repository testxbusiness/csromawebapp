// src/app/coach/calendar/page.tsx
'use client'

import PageHeader from '@/components/shared/PageHeader'
import CoachCalendarManager from '@/components/coach/CoachCalendarManager'

export default function CoachCalendarPage() {
  return (
    <>
      <PageHeader title="Gestione Calendario" subtitle="Area Coach" />
      <CoachCalendarManager />
    </>
  )
}
