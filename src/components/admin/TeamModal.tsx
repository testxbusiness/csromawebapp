'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'
import { createClient } from '@/lib/supabase/client'
import TrainingScheduleInput from './TrainingScheduleInput'
import {
  TrainingSchedule,
  checkGymScheduleConflicts,
  GymConflict
} from '@/lib/utils/trainingScheduleEvents'

type Team = {
  id?: string
  name: string
  code: string
  activity_id: string
  coach_id?: string
  training_rsvp_enabled?: boolean
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
  onCreate: (data: Omit<Team, 'id'>) => Promise<string> | string
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
  const supabase = React.useMemo(() => createClient(), [])
  const [saving, setSaving] = React.useState(false)
  const [loadingSchedules, setLoadingSchedules] = React.useState(false)
  const [trainingSchedules, setTrainingSchedules] = React.useState<TrainingSchedule[]>([])
  const [savedTeamId, setSavedTeamId] = React.useState<string | null>(null)
  const [feedback, setFeedback] = React.useState<{ tone: 'success' | 'warning' | 'error'; message: string } | null>(null)
  const [form, setForm] = React.useState<Team>({
    name: team?.name ?? '',
    code: team?.code ?? '',
    activity_id: team?.activity_id ?? '',
    coach_id: team?.coach_id ?? '',
    training_rsvp_enabled: team?.training_rsvp_enabled ?? false,
  })

  const loadTrainingSchedules = React.useCallback(async (teamId: string) => {
    setLoadingSchedules(true)
    try {
      const { data, error } = await supabase
        .from('team_training_schedules')
        .select('*')
        .eq('team_id', teamId)
        .eq('is_active', true)
        .order('day_of_week, start_time')

      if (!error && data) {
        setTrainingSchedules(data)
      }
    } catch (error) {
      console.error('Errore caricamento orari:', error)
    } finally {
      setLoadingSchedules(false)
    }
  }, [supabase])

  React.useEffect(() => {
    setForm({
      name: team?.name ?? '',
      code: team?.code ?? '',
      activity_id: team?.activity_id ?? '',
      coach_id: team?.coach_id ?? '',
      training_rsvp_enabled: team?.training_rsvp_enabled ?? false,
    })
    setSavedTeamId(team?.id ?? null)
    setFeedback(null)

    if (team?.id) {
      void loadTrainingSchedules(team.id)
    } else {
      setTrainingSchedules([])
    }
  }, [loadTrainingSchedules, open, team])

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
    const response = await fetch('/api/admin/training-schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team_id: teamId,
        schedules: trainingSchedules.map((schedule) => ({ ...schedule, team_id: teamId })),
      }),
    })
    const result = await response.json().catch(() => null) as {
      success?: boolean
      eventsCreated?: number
      eventsUpdated?: number
      eventsPreserved?: number
      warnings?: Array<{ message: string }>
      error?: string
    } | null
    if (!response.ok || result?.success === false) {
      const warning = result?.warnings?.map((item) => item.message).join(' ')
      throw new Error([result?.error ?? 'Errore salvataggio orari', warning].filter(Boolean).join(' '))
    }
    return result ?? {}
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.code || !form.activity_id) return
    setSaving(true)
    try {
      let teamId: string
      const teamData = {
        name: form.name,
        code: form.code.toUpperCase(),
        activity_id: form.activity_id,
        coach_id: form.coach_id || undefined,
        training_rsvp_enabled: form.training_rsvp_enabled ?? false,
      }

      if (team?.id || savedTeamId) {
        // Modifica team esistente
        teamId = team?.id ?? savedTeamId as string
        await onUpdate(teamId, teamData)
      } else {
        // La creazione avviene una sola volta nel manager; il callback restituisce l'ID.
        teamId = await onCreate(teamData)
        setSavedTeamId(teamId)
      }

      // Salva orari allenamento
      const report = await saveTrainingSchedules(teamId)

      if ((report.warnings?.length ?? 0) > 0) {
        setFeedback({
          tone: 'warning',
          message: `Squadra salvata. Eventi creati: ${report.eventsCreated ?? 0}; aggiornati: ${report.eventsUpdated ?? 0}; conservati: ${report.eventsPreserved ?? 0}. ${report.warnings?.map((item) => item.message).join(' ')}`,
        })
        return
      }

      onClose()
    } catch (error) {
      console.error('Errore salvataggio squadra:', error)
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Errore durante il salvataggio della squadra',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      {/* centrato, coerente con il DS */}
      <DialogContent className="cs-modal--centered cs-modal--md cs-modal--form">
        <DialogHeader>
          <DialogTitle>{team ? 'Modifica Squadra' : 'Nuova Squadra'}</DialogTitle>
          <DialogDescription className="sr-only">Inserisci o modifica i dati della squadra.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="team-name" className="cs-field__label">Nome Squadra *</label>
            <input
              id="team-name"
              type="text"
              className="cs-input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Es: Under 15, Primi Calci, Squadra A…"
            />
          </div>

          <div>
            <label htmlFor="team-activity" className="cs-field__label">Attività *</label>
            <select
              id="team-activity"
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
            <label htmlFor="team-code" className="cs-field__label">Codice Squadra *</label>
            <div className="flex gap-2">
              <input
                id="team-code"
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
            <label htmlFor="team-coach" className="cs-field__label">Allenatore</label>
            <select
              id="team-coach"
              className="cs-select"
              value={form.coach_id ?? ''}
              onChange={(e) => setForm({ ...form, coach_id: e.target.value })}
            >
              <option value="">Nessun allenatore assegnato</option>
              {coaches.map(c => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name}
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

            <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-[color:var(--cs-border)] p-3">
              <input
                id="team-rsvp-enabled"
                type="checkbox"
                className="mt-1 h-4 w-4 accent-[color:var(--cs-brand-red)]"
                checked={form.training_rsvp_enabled ?? false}
                onChange={(e) => setForm({ ...form, training_rsvp_enabled: e.target.checked })}
              />
              <span>
                <span className="block text-sm font-medium">Richiedi conferma presenza agli allenamenti</span>
                <span className="mt-1 block text-xs text-secondary">
                  Gli atleti potranno rispondere al prossimo allenamento e segnalare in anticipo le assenze.
                </span>
              </span>
            </label>
          </div>

          {feedback && (
            <div
              role={feedback.tone === 'error' ? 'alert' : 'status'}
              className={`rounded-lg border p-3 text-sm ${feedback.tone === 'error' ? 'border-red-300 bg-red-50 text-red-900' : feedback.tone === 'warning' ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-green-300 bg-green-50 text-green-900'}`}
            >
              {feedback.message}
            </div>
          )}

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
