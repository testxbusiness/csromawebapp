'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'

type Gym = {
  id?: string
  name: string
  address: string
  city: string
  capacity?: number
  season_id: string
  is_active?: boolean
}

type Season = {
  id: string
  name: string
  is_active: boolean
}

type Props = {
  open: boolean
  onClose: () => void
  gym: Gym | null
  seasons: Season[]
  onCreate: (data: Omit<Gym, 'id'>) => Promise<void> | void
  onUpdate: (id: string, data: Partial<Gym>) => Promise<void> | void
}

export default function GymModal({
  open,
  onClose,
  gym,
  seasons,
  onCreate,
  onUpdate,
}: Props) {
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState<Gym>({
    name: gym?.name ?? '',
    address: gym?.address ?? '',
    city: gym?.city ?? '',
    capacity: gym?.capacity ?? 0,
    season_id: gym?.season_id ?? (seasons.find(s => s.is_active)?.id ?? ''),
    is_active: gym?.is_active ?? true,
  })

  React.useEffect(() => {
    setForm({
      name: gym?.name ?? '',
      address: gym?.address ?? '',
      city: gym?.city ?? '',
      capacity: gym?.capacity ?? 0,
      season_id: gym?.season_id ?? (seasons.find(s => s.is_active)?.id ?? ''),
      is_active: gym?.is_active ?? true,
    })
  }, [gym, seasons])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.address || !form.city || !form.season_id) return
    setSaving(true)
    try {
      if (gym?.id) {
        await onUpdate(gym.id, {
          name: form.name,
          address: form.address,
          city: form.city,
          capacity: Number(form.capacity) || 0,
          season_id: form.season_id,
          is_active: !!form.is_active,
        })
      } else {
        await onCreate({
          name: form.name,
          address: form.address,
          city: form.city,
          capacity: Number(form.capacity) || 0,
          season_id: form.season_id,
          is_active: !!form.is_active,
        })
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      {/* variante centrata (non impatta gli altri modal) */}
      <DialogContent className="cs-modal--centered cs-modal--md">
        <DialogHeader>
          <DialogTitle>{gym ? 'Modifica Palestra' : 'Nuova Palestra'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="cs-field__label">Nome Palestra *</label>
            <input
              type="text"
              className="cs-input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Es: Palestra Comunale Roma Nord"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="cs-field__label">Indirizzo *</label>
              <input
                type="text"
                className="cs-input"
                required
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Es: Via Roma 123"
              />
            </div>
            <div>
              <label className="cs-field__label">Città *</label>
              <input
                type="text"
                className="cs-input"
                required
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Es: Roma"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="cs-field__label">Capacità</label>
              <input
                type="number"
                min={0}
                className="cs-input"
                value={form.capacity ?? 0}
                onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 0 })}
                placeholder="Es: 50"
              />
            </div>
            <label className="flex items-center gap-2 mt-6 md:mt-0">
              <input
                type="checkbox"
                checked={!!form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              <span className="text-sm">Palestra attiva</span>
            </label>
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
              {saving ? 'Salvataggio…' : gym ? 'Aggiorna' : 'Crea'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
