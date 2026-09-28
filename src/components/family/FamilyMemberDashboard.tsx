'use client'

import { EmptyState, ErrorState, LoadingState, Button } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import type { AccessibleProfile } from '@/context/AccessibleProfileContext'
import AthleteDashboard from '@/components/athlete/AthleteDashboard'
import { ArrowRight } from 'lucide-react'

const relationshipLabels: Record<string, string> = {
  parent: 'Genitore',
  guardian: 'Tutore',
  caregiver: 'Caregiver',
  delegate: 'Delegato',
}

function allowedSections(entry: AccessibleProfile) {
  const permissions = entry.relationship.permissions
  return [
    permissions.view_schedule ? 'Calendario e campionato' : null,
    permissions.confirm_attendance ? 'Conferma presenze' : null,
    permissions.receive_messages ? 'Messaggi' : null,
    permissions.view_payments ? 'Quote associative' : null,
    permissions.view_medical_status ? 'Stato certificato medico' : null,
    permissions.view_documents ? 'Documenti' : null,
  ].filter((section): section is string => Boolean(section))
}

export default function FamilyMemberDashboard() {
  const { user } = useAuth()
  const { profiles, selectedProfile, setSelectedProfileId, setActiveArea, loading, profilesLoaded, error, refresh } = useAccessibleProfiles()
  const profilesReady = profilesLoaded ?? true

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
        delegatedView
      />
    )
  }

  return (
    <div className="space-y-8">
      <section className="cs-card cs-card--primary cs-card--lg">
        <h1 className="cs-card__title">Area familiare</h1>
        <p className="cs-card__description">Seleziona un profilo collegato per accedere alle informazioni autorizzate.</p>
      </section>

      {loading || !profilesReady ? <LoadingState label="Caricamento profili collegati…" /> : null}
      {!loading && profilesReady && error ? <ErrorState title="Impossibile caricare i profili" description={error} action={<Button variant="outline" onClick={() => void refresh()}>Riprova</Button>} /> : null}
      {!loading && profilesReady && !error && profiles.length === 0 ? <EmptyState title="Nessun profilo collegato" description="Contatta l’amministratore per creare o verificare una relazione familiare." /> : null}
      {!loading && profilesReady && !error && profiles.length > 0 ? (
        <section className="cs-card cs-card--lg">
          <h2 className="cs-card__title">Profili collegati</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {profiles.map((entry) => {
              const { profile, relationship } = entry
              const sections = allowedSections(entry)
              return (
              <button
                key={`${profile.id}-${relationship.type}`}
                type="button"
                onClick={() => {
                  setActiveArea('family')
                  setSelectedProfileId(profile.id)
                }}
                className="group min-h-44 rounded-xl border border-[color:var(--cs-border)] p-4 text-left transition-colors hover:border-[color:var(--cs-primary)] hover:bg-[color:var(--cs-primary)]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--cs-primary)] focus-visible:ring-offset-2"
                aria-label={`Apri profilo di ${profile.first_name} ${profile.last_name}`}
              >
                <span className="flex h-full flex-col justify-between gap-6">
                  <span>
                    <span className="block font-semibold text-[color:var(--cs-text)]">{profile.first_name} {profile.last_name}</span>
                    <span className="mt-1 block text-sm text-[color:var(--cs-text-secondary)]">{relationshipLabels[relationship.type] || relationship.type}</span>
                    <span className="mt-3 block text-xs text-[color:var(--cs-text-tertiary)]">
                      {sections.length > 0
                        ? `Sezioni disponibili: ${sections.join(', ')}`
                        : 'Accesso alle informazioni di base'}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--cs-primary)]">
                    Apri profilo
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </span>
                </span>
              </button>
              )
            })}
          </div>
        </section>
      ) : null}
    </div>
  )
}
