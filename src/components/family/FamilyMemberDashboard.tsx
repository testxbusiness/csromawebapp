'use client'

import { useCallback, useEffect, useState } from 'react'
import { EmptyState, ErrorState, LoadingState, Button } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import AthleteDashboard from '@/components/athlete/AthleteDashboard'
import { ArrowRight } from 'lucide-react'

type AccessibleProfile = {
  profile: { id: string; first_name: string; last_name: string; email: string | null }
  relationship: { type: string; permissions: Record<string, boolean> }
}

const relationshipLabels: Record<string, string> = {
  parent: 'Genitore',
  guardian: 'Tutore',
  caregiver: 'Caregiver',
  delegate: 'Delegato',
}

export default function FamilyMemberDashboard() {
  const { user } = useAuth()
  const { selectedProfile, setSelectedProfileId } = useAccessibleProfiles()
  const [profiles, setProfiles] = useState<AccessibleProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProfiles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/me/accessible-profiles', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Impossibile caricare i profili collegati')
      setProfiles(result.profiles || [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossibile caricare i profili collegati')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadProfiles() }, [loadProfiles])

  if (selectedProfile && user) {
    return (
      <AthleteDashboard
        user={user}
        profile={{
          id: selectedProfile.profile.id,
          first_name: selectedProfile.profile.first_name,
          last_name: selectedProfile.profile.last_name,
          role: 'athlete',
        }}
      />
    )
  }

  return (
    <div className="space-y-8">
      <section className="cs-card cs-card--primary cs-card--lg">
        <h1 className="cs-card__title">Area familiare</h1>
        <p className="cs-card__description">Seleziona un profilo collegato per accedere alle informazioni autorizzate.</p>
      </section>

      {loading ? <LoadingState label="Caricamento profili collegati…" /> : null}
      {!loading && error ? <ErrorState title="Impossibile caricare i profili" description={error} action={<Button variant="outline" onClick={() => void loadProfiles()}>Riprova</Button>} /> : null}
      {!loading && !error && profiles.length === 0 ? <EmptyState title="Nessun profilo collegato" description="Contatta l’amministratore per creare o verificare una relazione familiare." /> : null}
      {!loading && !error && profiles.length > 0 ? (
        <section className="cs-card cs-card--lg">
          <h2 className="cs-card__title">Profili collegati</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {profiles.map(({ profile, relationship }) => (
              <button
                key={`${profile.id}-${relationship.type}`}
                type="button"
                onClick={() => setSelectedProfileId(profile.id)}
                className="group min-h-44 rounded-xl border border-[color:var(--cs-border)] p-4 text-left transition-colors hover:border-[color:var(--cs-primary)] hover:bg-[color:var(--cs-primary)]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--cs-primary)] focus-visible:ring-offset-2"
                aria-label={`Visualizza area atleta di ${profile.first_name} ${profile.last_name}`}
              >
                <span className="flex h-full flex-col justify-between gap-6">
                  <span>
                    <span className="block font-semibold text-[color:var(--cs-text)]">{profile.first_name} {profile.last_name}</span>
                    <span className="mt-1 block text-sm text-[color:var(--cs-text-secondary)]">{relationshipLabels[relationship.type] || relationship.type}</span>
                    <span className="mt-3 block text-xs text-[color:var(--cs-text-tertiary)]">I permessi disponibili sono gestiti dall’amministrazione.</span>
                  </span>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--cs-primary)]">
                    Visualizza area atleta
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
