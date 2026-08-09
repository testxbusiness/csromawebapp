'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import AdminModal from './AdminModal'
import type { Activity, AthleteCreateData, Season, Team } from './athleteTypes'

interface AthleteCreateModalProps {
  isOpen: boolean
  athlete?: AthleteCreateData | null
  seasons: Season[]
  activities: Activity[]
  teams: Team[]
  isSubmitting: boolean
  onSubmit: (data: AthleteCreateData) => void
  onClose: () => void
}

const emptyForm: AthleteCreateData = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  birth_date: '',
  season_id: '',
  membership_number: '',
  medical_certificate_expiry: '',
  personal_notes: '',
}

export default function AthleteCreateModal({
  isOpen,
  athlete,
  seasons,
  activities,
  teams,
  isSubmitting,
  onSubmit,
  onClose,
}: AthleteCreateModalProps) {
  const [formData, setFormData] = useState<AthleteCreateData>(emptyForm)

  const availableActivities = useMemo(
    () => activities.filter((activity) => activity.season_id === formData.season_id),
    [activities, formData.season_id]
  )
  const availableTeams = useMemo(
    () => teams.filter((team) => availableActivities.some((activity) => activity.id === team.activity_id)),
    [teams, availableActivities]
  )

  useEffect(() => {
    if (!isOpen) return
    setFormData(athlete || {
      ...emptyForm,
      season_id: seasons.find((season) => season.is_active)?.id || seasons[0]?.id || '',
    })
  }, [athlete, isOpen, seasons])

  const update = <K extends keyof AthleteCreateData>(key: K, value: AthleteCreateData[K]) => {
    setFormData((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit(formData)
  }

  return (
    <AdminModal
      isOpen={isOpen}
      title={athlete ? 'Modifica Atleta' : 'Nuovo Atleta'}
      onClose={onClose}
      sizeClassName="max-w-3xl"
      footer={(
        <>
          <button type="button" onClick={onClose} className="cs-btn cs-btn--ghost" disabled={isSubmitting}>
            Annulla
          </button>
          <button type="submit" form="athlete-create-form" className="cs-btn cs-btn--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Salvataggio...' : athlete ? 'Salva modifiche' : 'Crea Atleta'}
          </button>
        </>
      )}
    >
      <form id="athlete-create-form" onSubmit={handleSubmit} className="space-y-5">
        <div className="cs-alert cs-alert--info">
          Verrà creata solo l’anagrafica stagionale. L’account di accesso potrà essere aggiunto in seguito.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="athlete-first-name" className="cs-field__label">Nome *</label>
            <input id="athlete-first-name" className="cs-input" required value={formData.first_name} onChange={(event) => update('first_name', event.target.value)} />
          </div>
          <div>
            <label htmlFor="athlete-last-name" className="cs-field__label">Cognome *</label>
            <input id="athlete-last-name" className="cs-input" required value={formData.last_name} onChange={(event) => update('last_name', event.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="athlete-email" className="cs-field__label">Email di contatto</label>
            <input id="athlete-email" type="email" className="cs-input" value={formData.email ?? ''} onChange={(event) => update('email', event.target.value)} />
          </div>
          <div>
            <label htmlFor="athlete-phone" className="cs-field__label">Telefono</label>
            <input id="athlete-phone" type="tel" className="cs-input" value={formData.phone ?? ''} onChange={(event) => update('phone', event.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="athlete-birth-date" className="cs-field__label">Data di nascita</label>
            <input id="athlete-birth-date" type="date" className="cs-input" value={formData.birth_date ?? ''} onChange={(event) => update('birth_date', event.target.value)} />
          </div>
          <div>
            <label htmlFor="athlete-season" className="cs-field__label">Stagione *</label>
            <select
              id="athlete-season"
              className="cs-select"
              required
              value={formData.season_id}
              onChange={(event) => setFormData((current) => ({
                ...current,
                season_id: event.target.value,
                team_id: null,
                jersey_number: null,
              }))}
            >
              <option value="" disabled>Seleziona una stagione</option>
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>{season.name}{season.is_active ? ' (Attiva)' : ''}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="athlete-activity" className="cs-field__label">Attività</label>
            <select
              id="athlete-activity"
              className="cs-select"
              value={formData.team_id ? teams.find((team) => team.id === formData.team_id)?.activity_id ?? '' : ''}
              onChange={(event) => {
                const firstTeam = availableTeams.find((team) => team.activity_id === event.target.value)
                update('team_id', firstTeam?.id ?? null)
              }}
            >
              <option value="">Seleziona attività</option>
              {availableActivities.map((activity) => (
                <option key={activity.id} value={activity.id}>{activity.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="athlete-team" className="cs-field__label">Squadra</label>
            <select
              id="athlete-team"
              className="cs-select"
              value={formData.team_id ?? ''}
              onChange={(event) => update('team_id', event.target.value || null)}
              disabled={availableTeams.length === 0}
            >
              <option value="">Nessuna squadra</option>
              {availableTeams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="athlete-jersey-number" className="cs-field__label">Numero maglia</label>
            <input
              id="athlete-jersey-number"
              type="number"
              min={0}
              max={99}
              className="cs-input"
              value={formData.jersey_number ?? ''}
              onChange={(event) => update('jersey_number', event.target.value === '' ? null : Number(event.target.value))}
              disabled={!formData.team_id}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="athlete-membership-number" className="cs-field__label">Numero tessera</label>
            <input id="athlete-membership-number" className="cs-input" value={formData.membership_number ?? ''} onChange={(event) => update('membership_number', event.target.value)} />
          </div>
          <div>
            <label htmlFor="athlete-medical-expiry" className="cs-field__label">Scadenza certificato medico</label>
            <input id="athlete-medical-expiry" type="date" className="cs-input" value={formData.medical_certificate_expiry ?? ''} onChange={(event) => update('medical_certificate_expiry', event.target.value)} />
          </div>
        </div>

        <div>
          <label htmlFor="athlete-notes" className="cs-field__label">Note</label>
          <textarea id="athlete-notes" className="cs-textarea" rows={3} value={formData.personal_notes ?? ''} onChange={(event) => update('personal_notes', event.target.value)} />
        </div>
      </form>
    </AdminModal>
  )
}
