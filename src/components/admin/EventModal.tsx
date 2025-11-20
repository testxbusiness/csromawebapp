'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'

type Gym = { id: string; name: string; city: string }
type Activity = { id: string; name: string }
type Team = { id: string; name: string; code: string }

export type AdminEvent = {
  id?: string
  title: string
  description?: string
  start_date: string // ISO
  end_date: string   // ISO
  location?: string
  gym_id?: string
  activity_id?: string
  event_type: 'one_time' | 'recurring'
  event_kind?: 'training' | 'match' | 'meeting' | 'other'
  recurrence_rule?: { frequency: 'daily'|'weekly'|'monthly'; interval?: number }
  recurrence_end_date?: string // ISO
  selected_teams?: string[]
}

type Props = {
  open: boolean
  onClose: () => void
  event: AdminEvent | null
  gyms: Gym[]
  activities: Activity[]
  teams: Team[]
  onCreate: (data: Omit<AdminEvent, 'id'>) => Promise<void> | void
  onUpdate: (id: string, data: Partial<AdminEvent>) => Promise<void> | void
}

export default function EventModal({
  open,
  onClose,
  event,
  gyms,
  activities,
  teams,
  onCreate,
  onUpdate,
}: Props) {
  const [saving, setSaving] = React.useState(false)

  const [form, setForm] = React.useState({
    title: event?.title ?? '',
    description: event?.description ?? '',
    start_date: event?.start_date ? new Date(event.start_date).toISOString().slice(0,16) : '',
    end_date: event?.end_date ? new Date(event.end_date).toISOString().slice(0,16) : '',
    location: event?.location ?? '',
    gym_id: event?.gym_id ?? '',
    activity_id: event?.activity_id ?? '',
    event_type: event?.event_type ?? 'one_time' as 'one_time' | 'recurring',
    event_kind: (event?.event_kind ?? 'training') as 'training'|'match'|'meeting'|'other',
    recurrence_rule: (event?.recurrence_rule ?? { frequency: 'weekly', interval: 1 }) as { frequency: 'daily'|'weekly'|'monthly'; interval?: number },
    recurrence_end_date: event?.recurrence_end_date ? new Date(event.recurrence_end_date).toISOString().slice(0,16) : '',
    selected_teams: (event as any)?.event_teams?.map((et: any) => et.teams.id) ?? [],
    requires_confirmation: (event as any)?.requires_confirmation ?? false,
    confirmation_deadline: (event as any)?.confirmation_deadline ? new Date((event as any).confirmation_deadline).toISOString().slice(0,16) : '',
  })

  React.useEffect(() => {
    setForm({
      title: event?.title ?? '',
      description: event?.description ?? '',
      start_date: event?.start_date ? new Date(event.start_date).toISOString().slice(0,16) : '',
      end_date: event?.end_date ? new Date(event.end_date).toISOString().slice(0,16) : '',
      location: event?.location ?? '',
      gym_id: event?.gym_id ?? '',
      activity_id: event?.activity_id ?? '',
      event_type: event?.event_type ?? 'one_time',
      event_kind: (event?.event_kind ?? 'training') as any,
      recurrence_rule: (event?.recurrence_rule ?? { frequency: 'weekly', interval: 1 }) as any,
      recurrence_end_date: event?.recurrence_end_date ? new Date(event.recurrence_end_date).toISOString().slice(0,16) : '',
      selected_teams: (event as any)?.event_teams?.map((et: any) => et.teams.id) ?? [],
      requires_confirmation: (event as any)?.requires_confirmation ?? false,
      confirmation_deadline: (event as any)?.confirmation_deadline ? new Date((event as any).confirmation_deadline).toISOString().slice(0,16) : '',
    })
  }, [event])

  const toggleTeam = (teamId: string) => {
    setForm(prev => ({
      ...prev,
      selected_teams: prev.selected_teams.includes(teamId)
        ? prev.selected_teams.filter((id) => id !== teamId)
        : [...prev.selected_teams, teamId]
    }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload: any = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        start_date: new Date(form.start_date).toISOString(),
        end_date: new Date(form.end_date).toISOString(),
        location: form.location.trim() || undefined,
        gym_id: form.gym_id || undefined,
        activity_id: form.activity_id || undefined,
        event_type: form.event_type,
        event_kind: form.event_kind,
        recurrence_rule: form.event_type === 'recurring' ? form.recurrence_rule : undefined,
        recurrence_end_date: form.event_type === 'recurring' && form.recurrence_end_date
          ? new Date(form.recurrence_end_date).toISOString()
          : undefined,
        selected_teams: form.selected_teams,
        requires_confirmation: !!form.requires_confirmation,
        confirmation_deadline: form.requires_confirmation && form.confirmation_deadline ? new Date(form.confirmation_deadline).toISOString() : null,
      }

      if (event?.id) await onUpdate(event.id, payload)
      else await onCreate(payload)

      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="cs-modal--centered cs-modal--lg">
        <DialogHeader className="sr-only">
          <DialogTitle>{event ? 'Modifica Evento' : 'Nuovo Evento'}</DialogTitle>
        </DialogHeader>
        <div className="cs-modal__header" style={{ alignItems: 'center', gap: 12 }}>
          <div className="cs-modal__icon" aria-hidden>📅</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="cs-modal__title">{event ? 'Modifica Evento' : 'Nuovo Evento'}</h2>
            <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <span className="cs-badge cs-badge--neutral">{form.event_type === 'one_time' ? 'Singolo' : 'Ricorrente'}</span>
              <span className="cs-badge cs-badge--accent">{({training:'Allenamento', match:'Partita', meeting:'Riunione', other:'Altro'} as any)[form.event_kind]}</span>
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="cs-field__label">Titolo Evento *</label>
            <input
              className="cs-input"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Es: Allenamento U15, Partita amichevole…"
            />
          </div>

          <div>
            <label className="cs-field__label">Descrizione</label>
            <textarea
              className="cs-textarea"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Dettagli dell'evento (opzionale)"
            />
          </div>

          <div className="cs-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label className="cs-field__label">Data/Ora Inizio *</label>
              <input
                className="cs-input"
                type="datetime-local"
                required
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            <div>
              <label className="cs-field__label">Data/Ora Fine *</label>
              <input
                className="cs-input"
                type="datetime-local"
                required
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="cs-field__label">Luogo</label>
            <input
              className="cs-input"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Indirizzo o struttura"
            />
          </div>

          <div className="cs-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label className="cs-field__label">Palestra</label>
              <select
                className="cs-select"
                value={form.gym_id}
                onChange={(e) => setForm({ ...form, gym_id: e.target.value })}
              >
                <option value="">Seleziona una palestra</option>
                {gyms.map(g => (
                  <option key={g.id} value={g.id}>{g.name} - {g.city}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="cs-field__label">Attività</label>
              <select
                className="cs-select"
                value={form.activity_id}
                onChange={(e) => setForm({ ...form, activity_id: e.target.value })}
              >
                <option value="">Seleziona un&apos;attività</option>
                {activities.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="cs-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label className="cs-field__label">Tipo Evento</label>
              <select
                className="cs-select"
                value={form.event_type}
                onChange={(e) => setForm({ ...form, event_type: e.target.value as 'one_time'|'recurring' })}
              >
                <option value="one_time">Evento Singolo</option>
                <option value="recurring">Evento Ricorrente</option>
              </select>
            </div>
            <div>
              <label className="cs-field__label">Tipologia</label>
              <select
                className="cs-select"
                value={form.event_kind}
                onChange={(e) => setForm({ ...form, event_kind: e.target.value as any })}
              >
                <option value="training">Allenamento</option>
                <option value="match">Partita</option>
                <option value="meeting">Riunione</option>
                <option value="other">Altro</option>
              </select>
            </div>
          </div>

          {form.event_type === 'recurring' && (
          <div className="cs-card p-4 cs-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <label className="cs-field__label">Frequenza</label>
              <select
                className="cs-select"
                value={form.recurrence_rule.frequency}
                onChange={(e) => setForm({
                  ...form,
                  recurrence_rule: { ...form.recurrence_rule, frequency: e.target.value as any }
                })}
              >
                <option value="daily">Giornaliera</option>
                <option value="weekly">Settimanale</option>
                <option value="monthly">Mensile</option>
              </select>
            </div>
              <div>
                <label className="cs-field__label">Intervallo</label>
                <input
                  className="cs-input"
                  type="number"
                  min={1}
                  value={form.recurrence_rule.interval || 1}
                  onChange={(e) => setForm({
                    ...form,
                    recurrence_rule: { ...form.recurrence_rule, interval: Number(e.target.value) }
                  })}
                />
              </div>
              <div>
                <label className="cs-field__label">Fine Ricorrenza</label>
                <input
                  className="cs-input"
                  type="datetime-local"
                  value={form.recurrence_end_date}
                  onChange={(e) => setForm({ ...form, recurrence_end_date: e.target.value })}
                />
              </div>
            </div>
          )}

          <div>
            <label className="cs-field__label">Squadre Associate</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              {teams.map(t => (
                <label key={t.id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={form.selected_teams.includes(t.id)}
                    onChange={() => toggleTeam(t.id)}
                  />
                  <span className="ml-2 text-sm">{t.name} ({t.code})</span>
                </label>
              ))}
            </div>
            {teams.length === 0 && (
              <p className="text-xs text-secondary mt-1">Nessuna squadra disponibile.</p>
            )}
          </div>

          <div className="cs-card p-4">
            <label className="cs-field__label mb-2">Conferma partecipazione</label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!form.requires_confirmation}
                onChange={(e) => setForm({ ...form, requires_confirmation: e.target.checked })}
              />
              <span>Vuoi chiedere conferma partecipazione (RSVP)?</span>
            </label>
            {form.requires_confirmation && (
              <div className="mt-3">
                <label className="cs-field__label">Scadenza conferma (opzionale)</label>
                <input
                  type="datetime-local"
                  className="cs-input"
                  value={form.confirmation_deadline}
                  onChange={(e) => setForm({ ...form, confirmation_deadline: e.target.value })}
                />
                <p className="text-xs text-secondary mt-1">Se vuota, si può rispondere fino all’inizio dell’evento.</p>
              </div>
            )}
          </div>

          <div className="cs-modal__footer">
            <button type="button" className="cs-btn cs-btn--ghost" onClick={onClose}>Annulla</button>
            <button type="submit" className="cs-btn cs-btn--primary" disabled={saving}>
              {saving ? 'Salvataggio…' : event ? 'Aggiorna' : 'Crea'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
