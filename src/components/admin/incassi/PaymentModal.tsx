'use client'

import { useState, useEffect } from 'react'
import { toast } from '@/components/ui'

interface Installment {
  id: string
  amount: number
  status: string
  profile?: {
    first_name: string
    last_name: string
  }
  membership_fee?: {
    name: string
  }
  installment_number: number
}

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (paymentData: {
    paymentDate: string
    paymentMethod: string
  }) => void
  selectedInstallments: Installment[]
}

export default function PaymentModal({
  isOpen,
  onClose,
  onConfirm,
  selectedInstallments
}: PaymentModalProps) {
  const [paymentDate, setPaymentDate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')

  useEffect(() => {
    if (isOpen) {
      // Set default payment date to today
      const today = new Date().toISOString().split('T')[0]
      setPaymentDate(today)
    }
  }, [isOpen])

  const handleClose = () => {
    setPaymentDate('')
    setPaymentMethod('cash')
    onClose()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!paymentDate) {
      toast.error('Seleziona una data di pagamento')
      return
    }

    const paymentData = {
      paymentDate,
      paymentMethod
    }

    onConfirm(paymentData)
  }

  const getTotalAmount = () => {
    return selectedInstallments.reduce((total, installment) => {
      return total + installment.amount
    }, 0)
  }

  const paymentMethods = [
    { value: 'cash', label: 'Contanti' },
    { value: 'bank_transfer', label: 'Bonifico' },
    { value: 'credit_card', label: 'Carta di Credito' },
    { value: 'debit_card', label: 'Carta di Debito' },
    { value: 'check', label: 'Assegno' },
    { value: 'other', label: 'Altro' }
  ]

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 cs-overlay" aria-hidden="false">
      <div className="cs-modal cs-modal--lg" data-state="open">
        <button className="cs-modal__close" onClick={handleClose} aria-label="Chiudi">✕</button>
        <div className="cs-modal__header">
          <h2 className="cs-modal__title">Segna come pagate ({selectedInstallments.length} rate)</h2>
        </div>
        <form id="paymentForm" onSubmit={handleSubmit} className="cs-modal__body space-y-6">
          <div className="cs-card p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-secondary">Importo Totale</div>
                <div className="text-lg font-bold">€{getTotalAmount().toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
              </div>
              <div>
                <div className="text-secondary">Rate Selezionate</div>
                <div className="text-lg font-bold">{selectedInstallments.length}</div>
              </div>
              <div>
                <div className="text-secondary">Atleti Coinvolti</div>
                <div className="text-lg font-bold">{new Set(selectedInstallments.map(i => i.profile_id)).size}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="cs-field__label">Data Pagamento *</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
                className="cs-input"
              />
            </div>

            <div>
              <label className="cs-field__label">Metodo di Pagamento *</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                required
                className="cs-select"
              >
                {paymentMethods.map(method => (
                  <option key={method.value} value={method.value}>{method.label}</option>
                ))}
              </select>
            </div>
          </div>
        </form>
        <div className="cs-modal__footer">
          <div className="flex justify-end gap-2 w-full">
            <button type="button" onClick={handleClose} className="cs-btn cs-btn--ghost">Annulla</button>
            <button type="submit" form="paymentForm" className="cs-btn cs-btn--primary">Conferma ({selectedInstallments.length} rate)</button>
          </div>
        </div>
      </div>
    </div>
  )
}
