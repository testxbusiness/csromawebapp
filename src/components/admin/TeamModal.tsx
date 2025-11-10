'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'
import { createClient } from '@/lib/supabase/client'
import TrainingScheduleInput from './TrainingScheduleInput'
import {
  TrainingSchedule,
  generateTrainingEventsFromSchedules,
  checkGymScheduleConflicts,
  GymConflict
} from '@/lib/utils/trainingScheduleEvents'

type Team = {
  id?: string
  name: string
  code: string
  activity_id: string
  coach_id?: string
}

type Activity = {
  id: string
  name: string
  seasons?: { name: string } | null
}

type Coach = {
  id: string
  first_name: string
  last_name: string
  email: string
}

type Gym = {
  id: string
  name: string
  city?: string
  address?: string
}

type Props = {
  open: boolean
  onClose: () => void
  team: Team | null
  activities: Activity[]
  coaches: Coach[]
  gyms: Gym[]
  onCreate: (data: Omit<Team, 'id'>) => Promise<void> | void
  onUpdate: (id: string, data: Partial<Team>) => Promise<void> | void
  onGenerateCode: (teamName: string, activityName: string) => string
}

export default function TeamModal({
  open,
  onClose,
  team,
  activities,
  coaches,
  gyms,
  onCreate,
  onUpdate,
  onGenerateCode,
}: Props) {
  const supabase = createClient()
  const [saving, setSaving] = React.useState(false)
  const [loadingSchedules, setLoadingSchedules] = React.useState(false)
  const [trainingSchedules, setTrainingSchedules] = React.useState<TrainingSchedule[]>([])
  const [form, setForm] = React.useState<Team>({
    name: team?.name ?? '',
    code: team?.code ?? '',
    activity_id: team?.activity_id ?? '',
    coach_id: team?.coach_id ?? '',
  })

  React.useEffect(() => {
    setForm({
      name: team?.name ?? '',
      code: team?.code ?? '',
      activity_id: team?.activity_id ?? '',
      coach_id: team?.coach_id ?? '',
    })

    // Carica orari se in modifica, altrimenti resetta
    if (team?.id) {
      loadTrainingSchedules(team.id)
    } else {
      setTrainingSchedules([])
    }
  }, [team])

  const loadTrainingSchedules = async (teamId: string) => {
    setLoadingSchedules(true)
    try {
      const { data, error } = await supabase
        .from('team_training_schedules')
        .select('*')
        .eq('team_id', teamId)
        .order('day_of_week, start_time')

      if (!error && data) {
        setTrainingSchedules(data)
      }
    } catch (error) {
      console.error('Errore caricamento orari:', error)
    } finally {
      setLoadingSchedules(false)
    }
  }

  const handleGenerate = () => {
    const a = activities.find(x => x.id === form.activity_id)
    if (!form.name || !a) return
    const code = onGenerateCode(form.name, a.name)
    setForm(prev => ({ ...prev, code }))
  }

  const handleCheckConflicts = async (schedule: Partial<TrainingSchedule>): Promise<GymConflict[]> => {
    if (!schedule.gym_id || schedule.day_of_week === undefined || !schedule.start_time || !schedule.end_time) {
      return []
    }

    return await checkGymScheduleConflicts(
      schedule.gym_id,
      schedule.day_of_week,
      schedule.start_time,
      schedule.end_time,
      schedule.id,
      supabase
    )
  }

  const saveTrainingSchedules = async (teamId: string) => {
    // 1. Cancella tutti gli schedules esistenti per questo team
    await supabase
      .from('team_training_schedules')
      .delete()
      .eq('team_id', teamId)

    // 2. Inserisci i nuovi (se ce ne sono)
    if (trainingSchedules.length > 0) {
      const toInsert = trainingSchedules.map(s => ({
        team_id: teamId,
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        gym_id: s.gym_id,
        is_active: s.is_active ?? true,
      }))

      const { error } = await supabase
        .from('team_training_schedules')
        .insert(toInsert)

      if (error) {
        throw new Error('Errore salvataggio orari: ' + error.message)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.code || !form.activity_id) return
    setSaving(true)
    try {
      let teamId: string

      if (team?.id) {
        // Modifica team esistente
        teamId = team.id
        await onUpdate(teamId, {
          name: form.name,
          code: form.code.toUpperCase(),
          activity_id: form.activity_id,
          coach_id: form.coach_id || undefined,
        })
      } else {
        // Crea nuovo team - dobbiamo ottenere l'id
        // Nota: onCreate deve essere modificato per ritornare l'id
        // Per ora, creiamo direttamente qui per avere l'id
        const { data: newTeam, error: createError } = await supabase
          .from('teams')
          .insert([{
            name: form.name,
            code: form.code.toUpperCase(),
            activity_id: form.activity_id,
          }])
          .select('id')
          .single()

        if (createError || !newTeam) {
          throw new Error('Errore creazione squadra')
        }

        teamId = newTeam.id

        // Assegna coach se presente
        if (form.coach_id) {
          await supabase.from('team_coaches').insert({
            team_id: teamId,
            coach_id: form.coach_id,
            role: 'head_coach',
            assigned_at: new Date().toISOString().slice(0, 10)
          })
        }

        // Chiama onCreate per il refresh (può essere vuoto o solo per UI)
        await onCreate({
          name: form.name,
          code: form.code.toUpperCase(),
          activity_id: form.activity_id,
          coach_id: form.coach_id || undefined,
        })
      }

      // Salva orari allenamento
      await saveTrainingSchedules(teamId)

      // Genera eventi ricorrenti automaticamente
      const activeSchedules = trainingSchedules.filter(s => s.is_active !== false)
      if (activeSchedules.length > 0) {
        const result = await generateTrainingEventsFromSchedules(
          teamId,
          activeSchedules,
          supabase
        )

        if (!result.success) {
          console.error('Errore generazione eventi:', result.error)
          // Non bloccare il salvataggio, ma avvisare l'utente
          alert(`Squadra salvata, ma errore nella generazione degli eventi: ${result.error}`)
        }
      }

      onClose()
    } catch (error) {
      console.error('Errore salvataggio squadra:', error)
      alert('Errore durante il salvataggio della squadra')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      {/* centrato, coerente con il DS */}
      <DialogContent className="cs-modal--centered cs-modal--md">
        <DialogHeader>
          <DialogTitle>{team ? 'Modifica Squadra' : 'Nuova Squadra'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="cs-field__label">Nome Squadra *</label>
            <input
              type="text"
              className="cs-input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Es: Under 15, Primi Calci, Squadra A…"
            />
          </div>

          <div>
            <label className="cs-field__label">Attività *</label>
            <select
              required
              className="cs-select"
              value={form.activity_id}
              onChange={(e) => setForm({ ...form, activity_id: e.target.value })}
            >
              <option value="">Seleziona un'attività</option>
              {activities.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name}{a.seasons?.name ? ` (${a.seasons.name})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="cs-field__label">Codice Squadra *</label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                className="cs-input flex-1"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="Es: U15C001"
                maxLength={10}
              />
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!form.name || !form.activity_id}
                className="cs-btn cs-btn--ghost cs-btn--sm disabled:opacity-50"
                title="Genera codice"
              >
                Genera
              </button>
            </div>
            <p className="text-xs text-secondary mt-1">
              Il codice deve essere univoco. Usa “Genera” per crearne uno automaticamente.
            </p>
          </div>

          <div>
            <label className="cs-field__label">Allenatore</label>
            <select
              className="cs-select"
              value={form.coach_id ?? ''}
              onChange={(e) => setForm({ ...form, coach_id: e.target.value })}
            >
              <option value="">Nessun allenatore assegnato</option>
              {coaches.map(c => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name} ({c.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="cs-field__label">Orari Allenamento</label>
            <p className="text-xs text-secondary mb-2">
              Gli orari inseriti genereranno automaticamente eventi ricorrenti
              nel calendario fino alla fine della stagione.
            </p>

            {loadingSchedules ? (
              <div className="text-sm text-secondary p-4 bg-surface-secondary rounded-lg">
                Caricamento orari...
              </div>
            ) : (
              <TrainingScheduleInput
                schedules={trainingSchedules}
                onChange={setTrainingSchedules}
                gyms={gyms}
                onCheckConflicts={handleCheckConflicts}
              />
            )}
          </div>

          <div className="cs-modal__footer">
            <button type="button" className="cs-btn cs-btn--ghost" onClick={onClose}>
              Annulla
            </button>
            <button type="submit" className="cs-btn cs-btn--primary" disabled={saving}>
              {saving ? 'Salvataggio…' : team ? 'Aggiorna' : 'Crea'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
