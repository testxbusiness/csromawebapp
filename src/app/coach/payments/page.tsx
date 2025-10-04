'use client'

import CoachPaymentsManager from '@/components/coach/CoachPaymentsManager'
import PageHeader from '@/components/shared/PageHeader'

export default function CoachPaymentsPage() {
  return (
    <>
      <PageHeader title="Pagamenti" subtitle="Area Allenatore" />
      <CoachPaymentsManager />
    </>
  )
}
