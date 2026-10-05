import { Suspense } from 'react'
import DashboardClient from './DashboardClient'
import DashboardLoadingState from './DashboardLoadingState'

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoadingState />}>
      <DashboardClient />
    </Suspense>
  )
}
