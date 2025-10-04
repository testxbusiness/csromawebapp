'use client'

import BalanceDashboard from '@/components/admin/BalanceDashboard'
import PageHeader from '@/components/shared/PageHeader'

export default function BalancePage() {
  return (
    <>
      <PageHeader title="Bilancio Finanziario" subtitle="Amministrazione CSRoma" />
      <BalanceDashboard />
    </>
  )
}
