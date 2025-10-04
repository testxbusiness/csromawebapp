'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'

type Team = { id: string; name: string; code: string }

export type MembershipFee = {
  id?: string
  team_id: string
  name: string
  description?: string
  enrollment_fee: number
  insurance_fee: number
  monthly_fee: number
  months_count: number
  installments_count: number
  predefined_installments?: {
    id: string
    installment_number: number
    due_date: string
    amount: number
    description?: string
  }[]
}

type InstallmentForm = {
  installment_number: number
  due_date: string
  amount: number
}

type Props = {
  open: boolean
  onClose: () => void
  fee: MembershipFee | null
  teams: Team[]
  // Stesse firme che usi nel manager
  onCreate: (data: Omit<MembershipFee, 'id'> & { installments: InstallmentForm[] }) => void | Promise<void>
  onUpdate: (id: string, data: Partial<MembershipFee> & { installments?: InstallmentForm[] }) => void | Promise<void>
}

export default function MembershipFeeModal({
  open,
  onClose,
  fee,
  teams,
  onCreate,
  onUpdate,
}: Props) {
  const [saving, setSaving] = React.useState(false)

  const [formData, setFormData] = React.useState({
    team_id: fee?.team_id || '',
    name: fee?.name || '',
    description: fee?.description || '',
    enrollment_fee: fee?.enrollment_fee || 0,
    insurance_fee: fee?.insurance_fee || 0,
    monthly_fee: fee?.monthly_fee || 0,
    months_count: Number((fee?.months_count as any) ?? 0),
    installments_count: fee?.installments_count || 1,
  })

  const [installments, setInstallments] = React.useState<InstallmentForm[]>(
    fee?.predefined_installments?.map(inst => ({
      installment_number: inst.installment_number,
      due_date: inst.due_date,
      amount: inst.amount
    })) || []
  )

  React.useEffect(() => {
    setFormData({
      team_id: fee?.team_id || '',
      name: fee?.name || '',
      description: fee?.description || '',
      enrollment_fee: fee?.enrollment_fee || 0,
      insurance_fee: fee?.insurance_fee || 0,
      monthly_fee: fee?.monthly_fee || 0,
      months_count: Number((fee?.months_count as any) ?? 0),
      installments_count: fee?.installments_count || 1,
    })
    setInstallments(
      fee?.predefined_installments?.map(inst => ({
        installment_number: inst.installment_number,
        due_date: inst.due_date,
        amount: inst.amount
      })) || []
    )
  }, [fee])

  const calculatedTotal =
    (formData.enrollment_fee || 0) +
    (formData.insurance_fee || 0) +
    (formData.monthly_fee || 0) * (formData.months_count || 0)

  const handleNumberChange = (field: keyof typeof formData, value: string) => {
    const normalized = value.replace(',', '.')
    const numValue = parseFloat(normalized) || 0
    setFormData(prev => ({ ...prev, [field]: numValue }))
  }

  const addInstallment = () => {
    const nextNumber = installments.length + 1
    const today = new Date()
    const dueDate = new Date(today)
    dueDate.setMonth(today.getMonth() + nextNumber)

    const installmentAmount = calculatedTotal / (formData.installments_count || 1)

    setInstallments(prev => [
      ...prev,
      {
        installment_number: nextNumber,
        due_date: dueDate.toISOString().split('T')[0],
        amount: Math.round(installmentAmount * 100) / 100
      }
    ])
  }

  const removeInstallment = (index: number) => {
    setInstallments(prev => prev.filter((_, i) => i !== index))
  }

  const updateInstallment = (index: number, field: keyof InstallmentForm, value: string | number) => {
    setInstallments(prev => prev.map((inst, i) =>
      i === index ? { ...inst, [field]: value } : inst
    ))
  }

  const recalcSequence = () => {
    if (formData.installments_count > 0) {
      const today = new Date()
      const newInstallments = Array.from({ length: formData.installments_count }, (_, i) => {
        const existing = installments[i]
        const dueDate = new Date(today)
        dueDate.setMonth(today.getMonth() + i + 1)
        return {
          installment_number: i + 1,
          due_date: existing?.due_date || dueDate.toISOString().split('T')[0],
          amount: existing?.amount || 0
        }
      })
      setInstallments(newInstallments)
    }
  }

  React.useEffect(() => { recalcSequence() }, [formData.installments_count]) // eslint-disable-line

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...formData,
        installments,
      }
      if (fee?.id) await onUpdate(fee.id, payload)
      else await onCreate(payload)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="cs-modal--centered cs-modal--lg">
        <DialogHeader>
          <DialogTitle>{fee ? 'Modifica Quota' : 'Nuova Quota Associativa'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="cs-field__label">Nome Quota *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="cs-input"
              placeholder="Es: Quota Under 15 2024/2025"
            />
          </div>

          <div>
            <label className="cs-field__label">Descrizione</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="cs-textarea"
              placeholder="Descrizione della quota (opzionale)"
            />
          </div>

          <div>
            <label className="cs-field__label">Squadra *</label>
            <select
              value={formData.team_id}
              onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
              required
              className="cs-select"
            >
              <option value="">Seleziona una squadra</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name} ({team.code})
                </option>
              ))}
            </select>
          </div>

          <div className="cs-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label className="cs-field__label">Iscrizione (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.enrollment_fee}
                onChange={(e) => handleNumberChange('enrollment_fee', e.target.value)}
                className="cs-input"
              />
            </div>
            <div>
              <label className="cs-field__label">Assicurazione (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.insurance_fee}
                onChange={(e) => handleNumberChange('insurance_fee', e.target.value)}
                className="cs-input"
              />
            </div>
          </div>

          <div className="cs-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <label className="cs-field__label">Mensilità (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.monthly_fee}
                onChange={(e) => handleNumberChange('monthly_fee', e.target.value)}
                className="cs-input"
              />
            </div>
            <div>
              <label className="cs-field__label">Numero Mesi</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={formData.months_count}
                onChange={(e) => handleNumberChange('months_count', e.target.value)}
                className="cs-input"
              />
            </div>
            <div>
              <label className="cs-field__label">Numero Rate</label>
              <input
                type="number"
                min="1"
                value={formData.installments_count}
                onChange={(e) => handleNumberChange('installments_count', e.target.value)}
                className="cs-input"
              />
            </div>
          </div>

          <div className="cs-card">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-secondary">Importo Totale</div>
                <div className="text-xl font-bold">€{calculatedTotal.toFixed(2)}</div>
                <div className="text-xs text-secondary mt-1">
                  (Iscrizione €{formData.enrollment_fee.toFixed(2)} + Assicurazione €{formData.insurance_fee.toFixed(2)} + Mensilità €{formData.monthly_fee.toFixed(2)} × {formData.months_count} mesi)
                </div>
              </div>
              <button type="button" className="cs-btn cs-btn--outline" onClick={recalcSequence}>
                Ricalcola rate
              </button>
            </div>
          </div>

          {/* Gestione rate */}
          <div>
            <h4 className="text-md font-semibold mb-3">Rate predefinite</h4>
            <div className="space-y-3">
              {installments.map((inst, index) => (
                <div key={index} className="cs-card">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="cs-field__label">Rata {inst.installment_number} - Scadenza</label>
                      <input
                        type="date"
                        value={inst.due_date}
                        onChange={(e) => updateInstallment(index, 'due_date', e.target.value)}
                        className="cs-input"
                      />
                    </div>
                    <div>
                      <label className="cs-field__label">Importo (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={inst.amount}
                        onChange={(e) => updateInstallment(index, 'amount', parseFloat(e.target.value) || 0)}
                        className="cs-input"
                      />
                    </div>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <button type="button" onClick={() => removeInstallment(index)} className="cs-btn cs-btn--ghost cs-btn--sm">Rimuovi</button>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between">
                <span className="text-sm text-secondary">
                  Somma rate: €{installments.reduce((s, i) => s + (i.amount || 0), 0).toFixed(2)}
                </span>
                <button type="button" onClick={addInstallment} className="cs-btn cs-btn--accent cs-btn--sm">
                  + Aggiungi Rata
                </button>
              </div>

              {Math.abs(installments.reduce((s, i) => s + (i.amount || 0), 0) - calculatedTotal) > 0.01 && (
                <div className="cs-alert cs-alert--warning">
                  <div className="cs-alert__desc text-xs">
                    La somma delle rate non corrisponde all'importo totale.
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="cs-modal__footer">
            <button type="button" className="cs-btn cs-btn--ghost" onClick={onClose}>Annulla</button>
            <button type="submit" className="cs-btn cs-btn--primary" disabled={saving}>
              {saving ? 'Salvataggio…' : fee ? 'Aggiorna' : 'Crea'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
