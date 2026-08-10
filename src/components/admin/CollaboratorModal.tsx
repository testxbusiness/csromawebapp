'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import AdminModal from './AdminModal'
import type { Activity, Season, Team } from './coachTypes'

export type CollaboratorFormData = {
  first_name: string
  last_name: string
  email: string
  phone: string
  birth_date: string
  collaborator_type: 'coach' | 'staff' | 'admin'
  season_id: string
  level: string
  specialization: string
  started_on: string
  team_ids: string[]
  team_roles: Record<string, 'head_coach' | 'assistant_coach'>
}

interface Props {
  isOpen: boolean
  collaborator?: Partial<CollaboratorFormData> | null
  seasons: Season[]
  activities: Activity[]
  teams: Team[]
  isSubmitting: boolean
  onSubmit: (data: CollaboratorFormData) => void
  onClose: () => void
}

const emptyForm: CollaboratorFormData = { first_name: '', last_name: '', email: '', phone: '', birth_date: '', collaborator_type: 'coach', season_id: '', level: '', specialization: '', started_on: '', team_ids: [], team_roles: {} }

export default function CollaboratorModal({ isOpen, collaborator, seasons, activities, teams, isSubmitting, onSubmit, onClose }: Props) {
  const [form, setForm] = useState<CollaboratorFormData>(emptyForm)
  const availableTeams = useMemo(() => teams.filter((team) => activities.some((activity) => activity.id === team.activity_id && activity.season_id === form.season_id)), [activities, form.season_id, teams])

  useEffect(() => {
    if (!isOpen) return
    setForm({
      ...emptyForm,
      season_id: seasons.find((season) => season.is_active)?.id || seasons[0]?.id || '',
      ...collaborator,
      team_ids: collaborator?.team_ids || [],
      team_roles: collaborator?.team_roles || {},
    })
  }, [collaborator, isOpen, seasons])

  const update = <K extends keyof CollaboratorFormData>(key: K, value: CollaboratorFormData[K]) => setForm((current) => ({ ...current, [key]: value }))
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); onSubmit(form) }

  return <AdminModal isOpen={isOpen} title={collaborator ? 'Modifica Collaboratore' : 'Nuovo Collaboratore'} onClose={onClose} sizeClassName="max-w-4xl">
    <form id="collaborator-form" onSubmit={submit} className="space-y-5">
      <div className="cs-alert cs-alert--info">La persona viene collegata alla stagione selezionata. Staff e Admin possono restare senza squadra e attività.</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label htmlFor="collaborator-first-name" className="cs-field__label">Nome *</label><input id="collaborator-first-name" className="cs-input" required value={form.first_name} onChange={(e) => update('first_name', e.target.value)} /></div>
        <div><label htmlFor="collaborator-last-name" className="cs-field__label">Cognome *</label><input id="collaborator-last-name" className="cs-input" required value={form.last_name} onChange={(e) => update('last_name', e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label htmlFor="collaborator-email" className="cs-field__label">Email</label><input id="collaborator-email" type="email" className="cs-input" value={form.email} onChange={(e) => update('email', e.target.value)} /></div>
        <div><label htmlFor="collaborator-phone" className="cs-field__label">Telefono</label><input id="collaborator-phone" className="cs-input" value={form.phone} onChange={(e) => update('phone', e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div><label htmlFor="collaborator-birth-date" className="cs-field__label">Data di nascita</label><input id="collaborator-birth-date" type="date" className="cs-input" value={form.birth_date} onChange={(e) => update('birth_date', e.target.value)} /></div>
        <div><label htmlFor="collaborator-season" className="cs-field__label">Stagione *</label><select id="collaborator-season" className="cs-select" required value={form.season_id} onChange={(e) => setForm((current) => ({ ...current, season_id: e.target.value, team_ids: [], team_roles: {} }))}>{seasons.map((season) => <option key={season.id} value={season.id}>{season.name}{season.is_active ? ' (Attiva)' : ''}</option>)}</select></div>
        <div><label htmlFor="collaborator-type" className="cs-field__label">Tipo *</label><select id="collaborator-type" className="cs-select" required value={form.collaborator_type} onChange={(e) => { const type = e.target.value as CollaboratorFormData['collaborator_type']; setForm((current) => ({ ...current, collaborator_type: type, ...(type === 'coach' ? {} : { team_ids: [], team_roles: {} }) })) }}><option value="coach">Coach</option><option value="staff">Staff</option><option value="admin">Admin</option></select></div>
      </div>
      {form.collaborator_type === 'coach' && <>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><label htmlFor="collaborator-level" className="cs-field__label">Livello</label><input id="collaborator-level" className="cs-input" value={form.level} onChange={(e) => update('level', e.target.value)} /></div>
          <div><label htmlFor="collaborator-specialization" className="cs-field__label">Specializzazione</label><input id="collaborator-specialization" className="cs-input" value={form.specialization} onChange={(e) => update('specialization', e.target.value)} /></div>
          <div><label htmlFor="collaborator-started-on" className="cs-field__label">Inizio collaborazione</label><input id="collaborator-started-on" type="date" className="cs-input" value={form.started_on} onChange={(e) => update('started_on', e.target.value)} /></div>
        </div>
        <fieldset>
          <legend className="cs-field__label">Squadre assegnate</legend>
          <p className="text-sm text-secondary mb-3">Seleziona una o più squadre e indica il ruolo del coach in ciascuna.</p>
          <div className="space-y-2 rounded-lg border p-3">
            {availableTeams.length === 0 ? <p className="text-sm text-secondary">Nessuna squadra disponibile per la stagione selezionata.</p> : availableTeams.map((team) => {
              const selected = form.team_ids.includes(team.id)
              return <div key={team.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={selected} onChange={(event) => {
                    const teamIds = event.target.checked ? [...form.team_ids, team.id] : form.team_ids.filter((id) => id !== team.id)
                    const teamRoles = { ...form.team_roles }
                    if (event.target.checked) teamRoles[team.id] = teamRoles[team.id] || 'head_coach'
                    else delete teamRoles[team.id]
                    setForm((current) => ({ ...current, team_ids: teamIds, team_roles: teamRoles }))
                  }} />
                  <span>{team.name}</span>
                </label>
                {selected && <select aria-label={`Ruolo in ${team.name}`} className="cs-select sm:max-w-xs" value={form.team_roles[team.id] || 'head_coach'} onChange={(event) => setForm((current) => ({ ...current, team_roles: { ...current.team_roles, [team.id]: event.target.value as 'head_coach' | 'assistant_coach' } }))}><option value="head_coach">Head coach</option><option value="assistant_coach">Assistant coach</option></select>}
              </div>
            })}
          </div>
        </fieldset>
      </>}
      <div className="flex justify-end gap-3"><button type="button" onClick={onClose} className="cs-btn cs-btn--ghost" disabled={isSubmitting}>Annulla</button><button type="submit" className="cs-btn cs-btn--primary" disabled={isSubmitting}>{isSubmitting ? 'Salvataggio...' : collaborator ? 'Salva modifiche' : 'Crea collaboratore'}</button></div>
    </form>
  </AdminModal>
}
