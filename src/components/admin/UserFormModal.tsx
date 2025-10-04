'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminModal from './AdminModal'
import type { Team, User, UserFormData, AthleteProfile, CoachProfile } from './userTypes'

interface UserFormModalProps {
  isOpen: boolean
  user: User | null
  teams: Team[]
  isSubmitting: boolean
  onSubmit: (data: UserFormData) => void
  onClose: () => void
}

const emptyAthlete: AthleteProfile = {
  membership_number: '',
  medical_certificate_expiry: '',
  personal_notes: ''
}

const emptyCoach: CoachProfile = {
  level: '',
  specialization: '',
  started_on: ''
}

const buildInitialFormData = (user: User | null): UserFormData => ({
  email: user?.email || '',
  first_name: user?.first_name || '',
  last_name: user?.last_name || '',
  role: user?.role || 'athlete',
  phone: user?.phone || '',
  birth_date: user?.birth_date || '',
  team_ids: user?.teams?.map((team) => team.id) || [],
  team_assignments: [],
  athlete_profile: user?.athlete_profile ?? null,
  coach_profile: user?.coach_profile ?? null
})

export default function UserFormModal({
  isOpen,
  user,
  teams,
  isSubmitting,
  onSubmit,
  onClose
}: UserFormModalProps) {
  const supabase = createClient()
  const [formData, setFormData] = useState<UserFormData>(buildInitialFormData(user))
  const [selectedTeams, setSelectedTeams] = useState<string[]>(formData.team_ids || [])
  const [jerseyNumbers, setJerseyNumbers] = useState<Record<string, number | ''>>({})
  const [isDirty, setIsDirty] = useState(false)

  const [athleteData, setAthleteData] = useState<AthleteProfile>(user?.athlete_profile ?? emptyAthlete)
  const [coachData, setCoachData] = useState<CoachProfile>(user?.coach_profile ?? emptyCoach)

  useEffect(() => {
    if (!isOpen) return

    const initial = buildInitialFormData(user)
    setFormData(initial)
    setSelectedTeams(initial.team_ids || [])
    setJerseyNumbers({})
    setAthleteData(initial.athlete_profile ?? emptyAthlete)
    setCoachData(initial.coach_profile ?? emptyCoach)
    setIsDirty(false)
  }, [isOpen, user])

  useEffect(() => {
    const shouldPrefill = isOpen && user?.id && formData.role === 'athlete'
    if (!shouldPrefill) return

    const run = async () => {
      try {
        const { data } = await supabase
          .from('team_members')
          .select<{ team_id: string; jersey_number: number | null }>('team_id, jersey_number')
          .eq('profile_id', user.id)

        const jerseyRecord: Record<string, number | ''> = {}
        const teamIds: string[] = []
        for (const record of data || []) {
          jerseyRecord[record.team_id] = record.jersey_number ?? ''
          teamIds.push(record.team_id)
        }
        if (teamIds.length > 0) {
          setSelectedTeams(teamIds)
        }
        setJerseyNumbers(jerseyRecord)
      } catch (error) {
        console.error('Errore precompilazione numero maglia:', error)
      }
    }

    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user?.id, formData.role])

  const handleAttemptClose = () => {
    if (isDirty) {
      const shouldClose = window.confirm('Ci sono modifiche non salvate. Vuoi davvero chiudere?')
      if (!shouldClose) return
    }
    onClose()
  }

  const updateFormData = <K extends keyof UserFormData>(key: K, value: UserFormData[K]) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value
    }))
    setIsDirty(true)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const team_assignments = selectedTeams.map((teamId) => ({
      team_id: teamId,
      jersey_number:
        jerseyNumbers[teamId] === '' || jerseyNumbers[teamId] === undefined
          ? null
          : Number(jerseyNumbers[teamId])
    }))

    const payload: UserFormData = {
      ...formData,
      team_ids: selectedTeams,
      team_assignments,
      athlete_profile: formData.role === 'athlete'
        ? {
            membership_number: athleteData.membership_number ?? '',
            medical_certificate_expiry: athleteData.medical_certificate_expiry ?? '',
            personal_notes: athleteData.personal_notes ?? ''
          }
        : null,
      coach_profile: formData.role === 'coach'
        ? {
            level: coachData.level ?? '',
            specialization: coachData.specialization ?? '',
            started_on: coachData.started_on ?? ''
          }
        : null
    }

    onSubmit(payload)
  }

  const availableTeams = useMemo(() => teams, [teams])

  return (
    <AdminModal
      isOpen={isOpen}
      title={user ? 'Modifica Utente' : 'Nuovo Utente'}
      onClose={handleAttemptClose}
      footer={(
        <>
          <button type="button" onClick={handleAttemptClose} className="cs-btn cs-btn--ghost" disabled={isSubmitting}>Annulla</button>
          <button type="submit" form="user-form-modal" className="cs-btn cs-btn--primary disabled:opacity-60 disabled:cursor-not-allowed" disabled={isSubmitting}>
            {isSubmitting ? 'Salvataggio...' : user ? 'Aggiorna Utente' : 'Crea Utente'}
          </button>
        </>
      )}
    >
      <form id="user-form-modal" onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="cs-field__label">Nome *</label>
            <input
              type="text"
              required
              value={formData.first_name}
              onChange={(e) => updateFormData('first_name', e.target.value)}
              className="cs-input"
              placeholder="Nome"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="cs-field__label">Cognome *</label>
            <input
              type="text"
              required
              value={formData.last_name}
              onChange={(e) => updateFormData('last_name', e.target.value)}
              className="cs-input"
              placeholder="Cognome"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div>
          <label className="cs-field__label">Email *</label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) => updateFormData('email', e.target.value)}
            className="cs-input"
            placeholder="email@example.com"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="cs-field__label">Ruolo *</label>
          <select
            value={formData.role}
            onChange={(e) => {
              const nextRole = e.target.value as UserFormData['role']
              updateFormData('role', nextRole)
              setSelectedTeams([])
              setJerseyNumbers({})
              if (nextRole !== 'athlete') {
                setAthleteData(emptyAthlete)
              }
              if (nextRole !== 'coach') {
                setCoachData(emptyCoach)
              }
            }}
            className="cs-select"
            disabled={isSubmitting}
          >
            <option value="admin">Amministratore</option>
            <option value="coach">Allenatore</option>
            <option value="athlete">Atleta</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="cs-field__label">Telefono</label>
            <input
              type="tel"
              value={formData.phone || ''}
              onChange={(e) => updateFormData('phone', e.target.value)}
              className="cs-input"
              placeholder="+39 123 456 7890"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="cs-field__label">Data di nascita</label>
            <input
              type="date"
              value={formData.birth_date || ''}
              onChange={(e) => updateFormData('birth_date', e.target.value)}
              className="cs-input"
              disabled={isSubmitting}
            />
          </div>
        </div>

        {(formData.role === 'coach' || formData.role === 'athlete') && (
          <div>
            <label className="cs-field__label">Squadre assegnate</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 cs-card">
              {availableTeams.map((team) => (
                <div key={team.id} className="flex items-center justify-between">
                  <label className="flex items-center flex-1">
                    <input
                      type="checkbox"
                      checked={selectedTeams.includes(team.id)}
                      onChange={() => {
                        const alreadySelected = selectedTeams.includes(team.id)
                        setSelectedTeams((prev) =>
                          alreadySelected ? prev.filter((id) => id !== team.id) : [...prev, team.id]
                        )
                        setIsDirty(true)
                      }}
                      className="h-4 w-4"
                      disabled={isSubmitting}
                    />
                    <span className="ml-2 text-sm">
                      {team.name} ({team.code})
                      {team.activities && (
                        <span className="text-xs text-secondary ml-1">- {team.activities.name}</span>
                      )}
                    </span>
                  </label>
                  {formData.role === 'athlete' && selectedTeams.includes(team.id) && (
                    <div className="ml-3 flex items-center gap-2">
                      <label className="text-xs text-gray-600">N. Maglia</label>
                      <input
                        type="number"
                        className="w-20 px-2 py-1 border rounded text-sm"
                        value={jerseyNumbers[team.id] ?? ''}
                        onChange={(e) => {
                          setJerseyNumbers((prev) => ({
                            ...prev,
                            [team.id]: e.target.value === '' ? '' : Number(e.target.value)
                          }))
                          setIsDirty(true)
                        }}
                        min={0}
                        disabled={isSubmitting}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            {teams.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">Nessuna squadra disponibile. Crea prima delle squadre.</p>
            )}
          </div>
        )}

        {formData.role === 'athlete' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="cs-field__label">Numero tessera</label>
              <input
                type="text"
                value={athleteData.membership_number || ''}
                onChange={(e) => {
                  setAthleteData((prev) => ({ ...prev, membership_number: e.target.value }))
                  setIsDirty(true)
                }}
                className="cs-input"
                placeholder="Es: CSR-000123"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="cs-field__label">Scadenza certificato medico</label>
              <input
                type="date"
                value={athleteData.medical_certificate_expiry || ''}
                onChange={(e) => {
                  setAthleteData((prev) => ({ ...prev, medical_certificate_expiry: e.target.value }))
                  setIsDirty(true)
                }}
                className="cs-input"
                disabled={isSubmitting}
              />
            </div>
            <div className="md:col-span-2">
              <label className="cs-field__label">Note personali</label>
              <textarea
                value={athleteData.personal_notes || ''}
                onChange={(e) => {
                  setAthleteData((prev) => ({ ...prev, personal_notes: e.target.value }))
                  setIsDirty(true)
                }}
                className="cs-input"
                rows={3}
                placeholder="Informazioni aggiuntive sull’atleta"
                disabled={isSubmitting}
              />
            </div>
          </div>
        )}

        {formData.role === 'coach' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Livello</label>
              <input
                type="text"
                value={coachData.level || ''}
                onChange={(e) => {
                  setCoachData((prev) => ({ ...prev, level: e.target.value }))
                  setIsDirty(true)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Es: UEFA B"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Specializzazione</label>
              <input
                type="text"
                value={coachData.specialization || ''}
                onChange={(e) => {
                  setCoachData((prev) => ({ ...prev, specialization: e.target.value }))
                  setIsDirty(true)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Es: Preparazione atletica"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data inizio collaborazione</label>
              <input
                type="date"
                value={coachData.started_on || ''}
                onChange={(e) => {
                  setCoachData((prev) => ({ ...prev, started_on: e.target.value }))
                  setIsDirty(true)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSubmitting}
              />
            </div>
          </div>
        )}
      </form>
    </AdminModal>
  )
}
