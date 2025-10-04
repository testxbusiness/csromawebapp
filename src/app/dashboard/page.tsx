'use client'

import { useAuth } from '@/hooks/useAuth'
import AdminDashboard from '@/components/admin/AdminDashboard'
import CoachDashboard from '@/components/coach/CoachDashboard'
import AthleteDashboard from '@/components/athlete/AthleteDashboard'

export default function DashboardPage() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="cs-skeleton cs-skeleton--circle w-8 h-8"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="space-y-8">
      <section className="space-y-8">
        {profile?.role === 'admin' ? (
          <AdminDashboard user={user} profile={profile} />
        ) : profile?.role === 'coach' ? (
          <CoachDashboard user={user} profile={profile} />
        ) : profile?.role === 'athlete' ? (
          <AthleteDashboard user={user} profile={profile} />
        ) : (
          <div className="cs-card cs-card--lg">
            <h2 className="cs-card__title">Panoramica account</h2>
            <p className="cs-card__description">
              Ruolo non riconosciuto. Contatta l&apos;amministratore per verificare le autorizzazioni associate al tuo profilo.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
