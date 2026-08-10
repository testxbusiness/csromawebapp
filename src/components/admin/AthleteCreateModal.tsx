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
                team_ids: [],
                jersey_numbers: {},
              }))}
            >
              <option value="" disabled>Seleziona una stagione</option>
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>{season.name}{season.is_active ? ' (Attiva)' : ''}</option>
              ))}
            </select>
          </div>
        </div>

        <fieldset>
          <legend className="cs-field__label">Squadre assegnate</legend>
          <p className="text-sm text-secondary mb-3">Seleziona una o più squadre. Il numero di maglia può essere diverso per ogni squadra.</p>
          <div className="space-y-2 rounded-lg border p-3">
            {availableTeams.length === 0 ? <p className="text-sm text-secondary">Nessuna squadra disponibile per la stagione selezionata.</p> : availableTeams.map((team) => {
              const selected = (formData.team_ids || []).includes(team.id)
              return <div key={team.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={selected} onChange={(event) => {
                    const teamIds = event.target.checked ? [...(formData.team_ids || []), team.id] : (formData.team_ids || []).filter((id) => id !== team.id)
                    const jerseyNumbers = { ...(formData.jersey_numbers || {}) }
                    if (!event.target.checked) delete jerseyNumbers[team.id]
                    setFormData((current) => ({ ...current, team_ids: teamIds, jersey_numbers: jerseyNumbers }))
                  }} />
                  <span>{team.name}</span>
                </label>
                {selected && <input aria-label={`Numero maglia in ${team.name}`} type="number" min={0} max={99} className="cs-input sm:max-w-xs" placeholder="Numero maglia" value={formData.jersey_numbers?.[team.id] ?? ''} onChange={(event) => setFormData((current) => ({ ...current, jersey_numbers: { ...(current.jersey_numbers || {}), [team.id]: event.target.value === '' ? null : Number(event.target.value) } }))} />}
              </div>
            })}
          </div>
        </fieldset>

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
