'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

type Payment = {
  id?: string
  type: 'general_cost' | 'coach_payment'
  description: string
  amount: number
  frequency: 'one_time' | 'recurring'
  recurrence_pattern?: string
  status: 'to_pay' | 'paid'
  due_date?: string
  gym_id?: string
  activity_id?: string
  team_id?: string
  coach_id?: string
}

type Gym = { id: string; name: string; address: string }
type Activity = { id: string; name: string }
type Team = { id: string; name: string; code: string }
type Coach = { id: string; first_name: string; last_name: string }

type Props = {
  open: boolean
  onClose: () => void
  payment: Payment | null
  gyms: Gym[]
  activities: Activity[]
  teams: Team[]
  coaches: Coach[]
  onCreate: (data: Omit<Payment, 'id'>) => Promise<void> | void
  onUpdate: (id: string, data: Partial<Payment>) => Promise<void> | void
}

export default function PaymentModal({
  open,
  onClose,
  payment,
  gyms,
  activities,
  teams,
  coaches,
  onCreate,
  onUpdate,
}: Props) {
  const supabase = createClient()
  const [saving, setSaving] = React.useState(false)
  const [coachTeams, setCoachTeams] = React.useState<Team[]>([])

  const [form, setForm] = React.useState<Payment>({
    type: payment?.type ?? 'general_cost',
    description: payment?.description ?? '',
    amount: payment?.amount ?? 0,
    frequency: payment?.frequency ?? 'one_time',
    recurrence_pattern: payment?.recurrence_pattern ?? '',
    status: payment?.status ?? 'to_pay',
    due_date: payment?.due_date ?? '',
    gym_id: payment?.gym_id ?? '',
    activity_id: payment?.activity_id ?? '',
    team_id: payment?.team_id ?? '',
    coach_id: payment?.coach_id ?? '',
  })

  React.useEffect(() => {
    setForm({
      type: payment?.type ?? 'general_cost',
      description: payment?.description ?? '',
      amount: payment?.amount ?? 0,
      frequency: payment?.frequency ?? 'one_time',
      recurrence_pattern: payment?.recurrence_pattern ?? '',
      status: payment?.status ?? 'to_pay',
      due_date: payment?.due_date ?? '',
      gym_id: payment?.gym_id ?? '',
      activity_id: payment?.activity_id ?? '',
      team_id: payment?.team_id ?? '',
      coach_id: payment?.coach_id ?? '',
    })
  }, [payment])

  // Carica le squadre dell’allenatore selezionato (come nel tuo form inline)
  React.useEffect(() => {
    const loadCoachTeams = async (coachId: string) => {
      try {
        const { data, error } = await supabase
          .from('team_coaches')
          .select('teams ( id, name, code )')
          .eq('coach_id', coachId)

        if (error) throw error
        const list = (data?.map((r: any) => r.teams).filter(Boolean) ?? []) as Team[]
        setCoachTeams(list)
      } catch {
        setCoachTeams([])
      }
    }

    if (form.type === 'coach_payment' && form.coach_id) {
      loadCoachTeams(form.coach_id)
    } else {
      setCoachTeams([])
    }
  }, [form.type, form.coach_id, supabase])

  const handleNumber = (field: keyof Payment, value: string) =>
    setForm((p) => ({ ...p, [field]: parseFloat(value) || 0 } as Payment))

  const cleanAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      // Pulisci chiavi vuote
      const payload: any = { ...form }
      if (!payload.gym_id) delete payload.gym_id
      if (!payload.activity_id) delete payload.activity_id
      if (!payload.team_id) delete payload.team_id
      if (!payload.coach_id) delete payload.coach_id
      if (!payload.recurrence_pattern) delete payload.recurrence_pattern
      if (!payload.due_date) delete payload.due_date

      if (payment?.id) {
        await onUpdate(payment.id, payload)
      } else {
        await onCreate(payload)
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="cs-modal--centered cs-modal--md">
        <DialogHeader>
          <DialogTitle>{payment ? 'Modifica Pagamento' : 'Nuovo Pagamento'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={cleanAndSubmit} className="space-y-4">
          <div>
            <label className="cs-field__label">Tipo Pagamento *</label>
            <select
              className="cs-select"
              required
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as Payment['type'] })}
            >
              <option value="general_cost">Costo Generale</option>
              <option value="coach_payment">Pagamento Allenatore</option>
            </select>
          </div>

          <div>
            <label className="cs-field__label">Descrizione *</label>
            <input
              className="cs-input"
              type="text"
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Descrizione del pagamento"
            />
          </div>

          <div className="cs-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label className="cs-field__label">Importo (€) *</label>
              <input
                className="cs-input"
                type="number"
                step="0.01"
                min={0}
                required
                value={form.amount}
                onChange={(e) => handleNumber('amount', e.target.value)}
              />
            </div>
            <div>
              <label className="cs-field__label">Frequenza *</label>
              <select
                className="cs-select"
                required
                value={form.frequency}
                onChange={(e) =>
                  setForm({ ...form, frequency: e.target.value as Payment['frequency'] })
                }
              >
                <option value="one_time">Una tantum</option>
                <option value="recurring">Ricorrente</option>
              </select>
            </div>
          </div>

          {form.frequency === 'recurring' && (
            <div>
              <label className="cs-field__label">Pattern Ricorrenza</label>
              <input
                className="cs-input"
                type="text"
                value={form.recurrence_pattern ?? ''}
                onChange={(e) => setForm({ ...form, recurrence_pattern: e.target.value })}
                placeholder="Es: Mensile, Trimestrale, Annuale…"
              />
            </div>
          )}

          <div className="cs-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label className="cs-field__label">Stato *</label>
              <select
                className="cs-select"
                required
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Payment['status'] })}
              >
                <option value="to_pay">Da pagare</option>
                <option value="paid">Pagato</option>
              </select>
            </div>
            <div>
              <label className="cs-field__label">Data Scadenza</label>
              <input
                className="cs-input"
                type="date"
                value={form.due_date ?? ''}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
          </div>

          {/* Riferimenti: dipende dal tipo */}
          {form.type === 'general_cost' ? (
            <div className="cs-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div>
                <label className="cs-field__label">Palestra (opz.)</label>
                <select
                  className="cs-select"
                  value={form.gym_id ?? ''}
                  onChange={(e) => setForm({ ...form, gym_id: e.target.value })}
                >
                  <option value="">Nessuna palestra</option>
                  {gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div>
                <label className="cs-field__label">Attività (opz.)</label>
                <select
                  className="cs-select"
                  value={form.activity_id ?? ''}
                  onChange={(e) => setForm({ ...form, activity_id: e.target.value })}
                >
                  <option value="">Nessuna attività</option>
                  {activities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="cs-field__label">Squadra (opz.)</label>
                <select
                  className="cs-select"
                  value={form.team_id ?? ''}
                  onChange={(e) => setForm({ ...form, team_id: e.target.value })}
                >
                  <option value="">Nessuna squadra</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="cs-field__label">Allenatore *</label>
                <select
                  className="cs-select"
                  required
                  value={form.coach_id ?? ''}
                  onChange={(e) => setForm({ ...form, coach_id: e.target.value, team_id: '' })}
                >
                  <option value="">Seleziona un allenatore</option>
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                    </option>
                  ))}
                </select>
              </div>

              {form.coach_id && coachTeams.length > 0 && (
                <div>
                  <label className="cs-field__label">Squadra (opz.)</label>
                  <select
                    className="cs-select"
                    value={form.team_id ?? ''}
                    onChange={(e) => setForm({ ...form, team_id: e.target.value })}
                  >
                    <option value="">Nessuna squadra specifica</option>
                    {coachTeams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-secondary mt-1">
                    Seleziona una squadra per allocare il pagamento a quella squadra.
                  </p>
                </div>
              )}

              {form.coach_id && coachTeams.length === 0 && (
                <div className="cs-alert cs-alert--warning">
                  <div className="cs-alert__desc">
                    Questo allenatore non ha squadre assegnate. Il pagamento verrà registrato come generale per l'allenatore.
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="cs-modal__footer">
            <button type="button" className="cs-btn cs-btn--ghost" onClick={onClose}>
              Annulla
            </button>
            <button type="submit" className="cs-btn cs-btn--primary" disabled={saving}>
              {saving ? 'Salvataggio…' : payment ? 'Aggiorna' : 'Crea'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
