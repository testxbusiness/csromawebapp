'use client'

import { useAuth } from '@/hooks/useAuth'
import { useEffect, useState, useRef } from 'react'
import AdminDashboard from '@/components/admin/AdminDashboard'
import CoachDashboard from '@/components/coach/CoachDashboard'
import AthleteDashboard from '@/components/athlete/AthleteDashboard'

export default function DashboardPage() {
  const { user, profile, role, loading } = useAuth()

  const [lastValidState, setLastValidState] = useState<{
    user: typeof user
    profile: typeof profile
    role: typeof role
  } | null>(null)

  const hasShownData = useRef(false)

  useEffect(() => {
    if (user && profile && role) {
      setLastValidState({ user, profile, role })
      hasShownData.current = true
    }
  }, [user, profile, role])

  const displayUser = user || lastValidState?.user
  const displayProfile = profile || lastValidState?.profile
  const displayRole = role || lastValidState?.role

  if (loading && !hasShownData.current) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="cs-skeleton cs-skeleton--circle w-12 h-12"></div>
          <div className="cs-skeleton w-48 h-4"></div>
        </div>
      </div>
    )
  }

  if (!displayUser || !displayProfile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="cs-skeleton cs-skeleton--circle w-12 h-12"></div>
          <div className="cs-skeleton w-48 h-4"></div>
        </div>
      </div>
    )
  }

  const isRefreshing = loading && hasShownData.current

  return (
    <div className="space-y-8 relative">
      {isRefreshing && (
        <div className="fixed top-20 right-4 z-50 bg-[color:var(--cs-primary)] text-white px-3 py-1.5 rounded-full text-xs shadow-lg flex items-center gap-2">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          Aggiornamento...
        </div>
      )}

      <section className="space-y-8">
        {displayRole === 'admin' ? (
          <AdminDashboard user={displayUser} profile={displayProfile} />
        ) : displayRole === 'coach' ? (
          <CoachDashboard user={displayUser} profile={displayProfile} />
        ) : displayRole === 'athlete' ? (
          <AthleteDashboard user={displayUser} profile={displayProfile} />
        ) : (
          <div className="cs-card cs-card--lg">
            <h2 className="cs-card__title">Panoramica account</h2>
            <p className="cs-card__description">
              Ruolo non riconosciuto. Contatta l&apos;amministratore per verificare le autorizzazioni associate al tuo profilo.
            </p>

            {process.env.NEXT_PUBLIC_DEBUG_ROLE && (
              <pre className="mt-3 text-xs opacity-70">
                {JSON.stringify(
                  {
                    roleFromProfile: displayProfile?.role,
                    roleFromAppMeta: (displayUser as any)?.app_metadata?.role,
                    roleFromUserMeta: (displayUser as any)?.user_metadata?.role,
                    resolvedRole: displayRole,
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
