'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'

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

type Props = {
  open: boolean
  onClose: () => void
  team: Team | null
  activities: Activity[]
  coaches: Coach[]
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
  onCreate,
  onUpdate,
  onGenerateCode,
}: Props) {
  const [saving, setSaving] = React.useState(false)
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
  }, [team])

  const handleGenerate = () => {
    const a = activities.find(x => x.id === form.activity_id)
    if (!form.name || !a) return
    const code = onGenerateCode(form.name, a.name)
    setForm(prev => ({ ...prev, code }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.code || !form.activity_id) return
    setSaving(true)
    try {
      if (team?.id) {
        await onUpdate(team.id, {
          name: form.name,
          code: form.code.toUpperCase(),
          activity_id: form.activity_id,
          coach_id: form.coach_id || undefined,
        })
      } else {
        await onCreate({
          name: form.name,
          code: form.code.toUpperCase(),
          activity_id: form.activity_id,
          coach_id: form.coach_id || undefined,
        })
      }
      onClose()
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
