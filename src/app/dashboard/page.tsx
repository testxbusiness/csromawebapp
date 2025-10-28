'use client'

import { useAuth } from '@/hooks/useAuth'
import AdminDashboard from '@/components/admin/AdminDashboard'
import CoachDashboard from '@/components/coach/CoachDashboard'
import AthleteDashboard from '@/components/athlete/AthleteDashboard'

export default function DashboardPage() {
  // 👇 il hook ora espone anche `role` già normalizzato
  const { user, profile, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="cs-skeleton cs-skeleton--circle w-8 h-8"></div>
      </div>
    )
  }

  // Evita render finché profilo non è disponibile (prevenzione crash)
  if (!user || !profile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="cs-skeleton w-8 h-8"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <section className="space-y-8">
        {role === 'admin' ? (
          <AdminDashboard user={user} profile={profile} />
        ) : role === 'coach' ? (
          <CoachDashboard user={user} profile={profile} />
        ) : role === 'athlete' ? (
          <AthleteDashboard user={user} profile={profile} />
        ) : (
          <div className="cs-card cs-card--lg">
            <h2 className="cs-card__title">Panoramica account</h2>
            <p className="cs-card__description">
              Ruolo non riconosciuto. Contatta l&apos;amministratore per verificare le autorizzazioni associate al tuo profilo.
            </p>

            {/* debug opzionale: abilita su Vercel con NEXT_PUBLIC_DEBUG_ROLE=1 */}
            {process.env.NEXT_PUBLIC_DEBUG_ROLE && (
              <pre className="mt-3 text-xs opacity-70">
                {JSON.stringify(
                  {
                    roleFromProfile: profile?.role,
                    // @ts-ignore
                    roleFromAppMeta: user?.app_metadata?.role,
                    // @ts-ignore
                    roleFromUserMeta: user?.user_metadata?.role,
                    resolvedRole: role,
                  },
                  null,
                  2
                )}
              </pre>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
