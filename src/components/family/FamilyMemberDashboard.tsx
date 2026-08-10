'use client'

import { useCallback, useEffect, useState } from 'react'
import { EmptyState, ErrorState, LoadingState, Button } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import AthleteDashboard from '@/components/athlete/AthleteDashboard'

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
  const { selectedProfile } = useAccessibleProfiles()
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
        <p className="cs-card__description">Consulta solo le informazioni dei profili che l’amministrazione ti ha collegato.</p>
      </section>

      {loading ? <LoadingState label="Caricamento profili collegati…" /> : null}
      {!loading && error ? <ErrorState title="Impossibile caricare i profili" description={error} action={<Button variant="outline" onClick={() => void loadProfiles()}>Riprova</Button>} /> : null}
      {!loading && !error && profiles.length === 0 ? <EmptyState title="Nessun profilo collegato" description="Contatta l’amministratore per creare o verificare una relazione familiare." /> : null}
      {!loading && !error && profiles.length > 0 ? (
        <section className="cs-card cs-card--lg">
          <h2 className="cs-card__title">Profili collegati</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {profiles.map(({ profile, relationship }) => (
              <article key={`${profile.id}-${relationship.type}`} className="rounded-xl border border-[color:var(--cs-border)] p-4">
                <h3 className="font-semibold text-[color:var(--cs-text)]">{profile.first_name} {profile.last_name}</h3>
                <p className="mt-1 text-sm text-[color:var(--cs-text-secondary)]">{relationshipLabels[relationship.type] || relationship.type}</p>
                <p className="mt-3 text-xs text-[color:var(--cs-text-tertiary)]">I permessi disponibili sono gestiti dall’amministrazione.</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
