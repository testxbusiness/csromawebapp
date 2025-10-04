'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'

type Activity = {
  id?: string
  name: string
  description?: string
  season_id: string
}

type Season = {
  id: string
  name: string
  is_active: boolean
}

type Props = {
  open: boolean
  onClose: () => void
  activity: Activity | null
  seasons: Season[]
  onCreate: (data: Omit<Activity, 'id'>) => Promise<void> | void
  onUpdate: (id: string, data: Partial<Activity>) => Promise<void> | void
}

export default function ActivityModal({
  open,
  onClose,
  activity,
  seasons,
  onCreate,
  onUpdate,
}: Props) {
  const [form, setForm] = React.useState<Activity>({
    name: activity?.name ?? '',
    description: activity?.description ?? '',
    season_id:
      activity?.season_id ??
      (seasons.find((s) => s.is_active)?.id ?? ''),
  })
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    setForm({
      name: activity?.name ?? '',
      description: activity?.description ?? '',
      season_id:
        activity?.season_id ??
        (seasons.find((s) => s.is_active)?.id ?? ''),
    })
  }, [activity, seasons])

  const predefined = [
    'Calcio','Pallavolo','Basket','Tennis','Nuoto','Atletica','Pallamano','Rugby',
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.season_id) return
    setSaving(true)
    try {
      if (activity?.id) {
        await onUpdate(activity.id, {
          name: form.name,
          description: form.description,
          season_id: form.season_id,
        })
      } else {
        await onCreate({
          name: form.name,
          description: form.description,
          season_id: form.season_id,
        })
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      {/* Variante centrata + larghezza media */}
      <DialogContent className="cs-modal--centered cs-modal--md" >
        <DialogHeader>
          <DialogTitle>
            {activity ? 'Modifica Attività' : 'Nuova Attività Sportiva'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="cs-field__label">Nome Attività *</label>
            <input
              type="text"
              className="cs-input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Es: Calcio, Pallavolo, Basket…"
            />
            {!activity && (
              <div className="mt-2">
                <p className="text-xs text-secondary mb-2">Suggerimenti:</p>
                <div className="flex flex-wrap gap-2">
                  {predefined.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setForm({ ...form, name })}
                      className="cs-btn cs-btn--ghost cs-btn--sm"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="cs-field__label">Descrizione</label>
            <textarea
              rows={3}
              className="cs-textarea"
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Descrizione dell'attività (opzionale)"
            />
          </div>

          <div>
            <label className="cs-field__label">Stagione *</label>
            <select
              className="cs-select"
              required
              value={form.season_id}
              onChange={(e) => setForm({ ...form, season_id: e.target.value })}
            >
              <option value="">Seleziona una stagione</option>
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.is_active && '(Attiva)'}
                </option>
              ))}
            </select>
          </div>

          <div className="cs-modal__footer">
            <button type="button" className="cs-btn cs-btn--ghost" onClick={onClose}>
              Annulla
            </button>
            <button type="submit" className="cs-btn cs-btn--primary" disabled={saving}>
              {saving ? 'Salvataggio…' : activity ? 'Aggiorna' : 'Crea'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
