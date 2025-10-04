'use client'

import { useEffect, useMemo, useState } from 'react'

type Payment = {
  id: string
  type: 'coach_payment'
  description: string
  amount: number
  frequency: 'one_time' | 'recurring'
  status: 'to_pay' | 'paid'
  due_date?: string
  paid_at?: string
  teams?: { id: string; name: string; code: string } | null
  gyms?: { id: string; name: string; address: string } | null
  activities?: { id: string; name: string } | null
  coaches?: { id: string; first_name: string; last_name: string } | null
  created_by_profile?: { first_name: string; last_name: string } | null
}

export default function CoachPaymentsManager() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<'all' | 'to_pay' | 'paid'>('all')

  useEffect(() => {
    loadPayments()
  }, [])

  const loadPayments = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/coach/payments')
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Errore caricamento')
      setPayments(data || [])
    } catch (e) {
      console.error('Errore caricamento pagamenti coach:', e)
      setPayments([])
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    return payments.filter(p => filterStatus === 'all' || p.status === filterStatus)
  }, [payments, filterStatus])

  const totalAmount = useMemo(() => filtered.reduce((s, p) => s + (p.amount || 0), 0), [filtered])
  const pendingAmount = useMemo(() => filtered.filter(p => p.status === 'to_pay').reduce((s, p) => s + (p.amount || 0), 0), [filtered])
  const paidAmount = useMemo(() => filtered.filter(p => p.status === 'paid').reduce((s, p) => s + (p.amount || 0), 0), [filtered])

  const statusBadge = (status: Payment['status']) => status === 'paid' ? 'cs-badge cs-badge--success' : 'cs-badge cs-badge--warning'

  if (loading) return <div className="p-4">Caricamento pagamenti...</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gestione Pagamenti</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="cs-card">
          <div className="cs-card__meta">Totale Pagamenti</div>
          <div className="text-2xl font-bold">€{totalAmount.toFixed(2)}</div>
          <div className="text-xs text-secondary">{filtered.length} pagamenti</div>
        </div>
        <div className="cs-card">
          <div className="cs-card__meta">Da Pagare</div>
          <div className="text-2xl font-bold" style={{color:'var(--cs-warning)'}}>€{pendingAmount.toFixed(2)}</div>
          <div className="text-xs text-secondary">{filtered.filter(p => p.status === 'to_pay').length} in sospeso</div>
        </div>
        <div className="cs-card">
          <div className="cs-card__meta">Pagati</div>
          <div className="text-2xl font-bold" style={{color:'var(--cs-success)'}}>€{paidAmount.toFixed(2)}</div>
          <div className="text-xs text-secondary">{filtered.filter(p => p.status === 'paid').length} completati</div>
        </div>
      </div>

      <div className="cs-card p-4 flex gap-4 items-center">
        <div>
          <label className="cs-field__label">Stato</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="cs-select"
          >
            <option value="all">Tutti gli stati</option>
            <option value="to_pay">Da pagare</option>
            <option value="paid">Pagato</option>
          </select>
        </div>
      </div>

      <div className="cs-card overflow-hidden">
        <table className="cs-table">
          <thead>
            <tr>
              <th>Descrizione</th>
              <th>Tipo</th>
              <th>Importo</th>
              <th>Stato</th>
              <th>Scadenza</th>
              <th>Riferimento</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id}>
                <td className="px-6 py-4">
                  <div className="font-medium">{p.description}</div>
                  <div className="text-xs text-secondary">{p.frequency === 'one_time' ? 'Una tantum' : 'Ricorrente'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="cs-badge cs-badge--neutral">Allenatore</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">€{(p.amount ?? 0).toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={statusBadge(p.status)}>
                    {p.status === 'paid' ? 'Pagato' : 'Da pagare'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{p.due_date ? new Date(p.due_date).toLocaleDateString('it-IT') : 'N/D'}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {p.coaches ? `Allenatore: ${p.coaches.first_name} ${p.coaches.last_name}` : '—'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary">
                  —
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="px-6 py-8 text-center">
            <div className="text-secondary mb-4"><span className="text-4xl">💶</span></div>
            <h3 className="text-lg font-semibold mb-2">Nessun pagamento</h3>
            <p className="text-secondary">Qui vedrai i pagamenti a te assegnati dall'amministratore.</p>
          </div>
        )}
      </div>
    </div>
  )
}
