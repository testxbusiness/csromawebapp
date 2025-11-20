// src/components/athlete/AthleteFeesManager.tsx
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import PageHeader from '@/components/shared/PageHeader' // se vuoi l'header qui, altrimenti toglilo
// import EventDetails from '@/components/.../EventDetails' // TODO: se lo usi davvero, importa il path corretto

interface FeeInstallment {
  id: string
  installment_number: number
  due_date: string
  amount: number
  status: string
  paid_at?: string
  membership_fee: {
    id: string
    name: string
    description?: string
    total_amount: number
    enrollment_fee: number
    insurance_fee: number
    monthly_fee: number
    months_count: number
    installments_count: number
    team: {
      name: string
      code: string
      activity: { name: string }
    }
  }
}

export default function AthleteFeesManager() {
  const { user } = useAuth()
  const userId = user?.id || null

  const [installments, setInstallments] = useState<FeeInstallment[]>([])
  const [filteredInstallments, setFilteredInstallments] = useState<FeeInstallment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all')
  const [selectedEvent, setSelectedEvent] = useState<{ id: string } | null>(null)

  const statusToBadge = (status: 'not_due' | 'due_soon' | 'overdue' | 'partially_paid' | 'paid') => {
    switch (status) {
      case 'paid': return 'cs-badge--success'
      case 'overdue': return 'cs-badge--danger'
      case 'due_soon': return 'cs-badge--warning'
      case 'partially_paid': return 'cs-badge--neutral'
      case 'not_due':
      default: return 'cs-badge--neutral'
    }
  }

  const fetchControllerRef = useRef<AbortController | null>(null)

  const loadInstallments = useCallback(async (signal?: AbortSignal) => {
    if (!userId) {
      setInstallments([])
      setFilteredInstallments([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/athlete/fees', { signal })
      if (!response.ok) {
        console.error('Error loading fee installments (athlete):', response.statusText)
        setInstallments([])
        return
      }

      const result = await response.json()
      setInstallments(result.installments || [])
    } catch (error: any) {
      if (error?.name === 'AbortError') return
      console.error('Error loading fee installments (athlete):', error)
      setInstallments([])
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) {
      fetchControllerRef.current?.abort()
      fetchControllerRef.current = null
      setInstallments([])
      setFilteredInstallments([])
      setLoading(false)
      return
    }

    const controller = new AbortController()
    fetchControllerRef.current?.abort()
    fetchControllerRef.current = controller
    void loadInstallments(controller.signal)

    return () => {
      controller.abort()
    }
  }, [userId, loadInstallments])

  useEffect(() => {
    filterInstallments()
  }, [installments, filter])

  function filterInstallments() {
    if (filter === 'pending') setFilteredInstallments(installments.filter(i => i.status !== 'paid'))
    else if (filter === 'paid') setFilteredInstallments(installments.filter(i => i.status === 'paid'))
    else if (filter === 'overdue') setFilteredInstallments(installments.filter(i => i.status === 'overdue'))
    else setFilteredInstallments(installments)
  }

  const getStatusText = (status: string) =>
    status === 'paid' ? '✅ Pagata'
    : status === 'overdue' ? '❌ Scaduta'
    : status === 'due_soon' ? '⚠️ In Scadenza'
    : status === 'not_due' ? '⏳ Non Scaduta'
    : status

  const teamTotals = (() => {
    const m = new Map<string, any>()
    installments.forEach(inst => {
      const key = inst.membership_fee.team.name
      if (!m.has(key)) m.set(key, { team: inst.membership_fee.team, totalAmount: 0, paidAmount: 0, pendingAmount: 0, installments: [] as FeeInstallment[] })
      const t = m.get(key)
      t.totalAmount += inst.amount
      t.installments.push(inst)
      if (inst.status === 'paid') t.paidAmount += inst.amount
      else t.pendingAmount += inst.amount
    })
    return Array.from(m.values())
  })()

  // Riepilogo per quota (membership_fee) per mostrare dettagli: iscrizione, assicurazione, mensile, mesi e riferimenti
  const feeSummaries = (() => {
    const m = new Map<string, FeeInstallment['membership_fee']>()
    installments.forEach((inst) => {
      const fee = inst.membership_fee
      const key = fee?.id || `${fee?.team?.name}-${fee?.name}`
      if (fee && !m.has(key)) m.set(key, fee)
    })
    return Array.from(m.values())
  })()

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header opzionale della pagina */}
      <PageHeader title="Le Mie Quote Associative" subtitle="Area Atleta" />

      {/* Riepilogo quote (dettagli quota) */}
      {feeSummaries.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Dettaglio Quota Associativa</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {feeSummaries.map((fee) => (
              <div key={fee.id} className="cs-card cs-card--primary">
                <div className="mb-2">
                  <div className="text-sm font-medium text-secondary">
                    {fee.team.name} ({fee.team.code}) • {fee.team.activity.name}
                  </div>
                  <div className="text-base font-semibold">{fee.name}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-secondary">Iscrizione</span>
                    <span>€{Number(fee.enrollment_fee || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-secondary">Assicurazione</span>
                    <span>€{Number(fee.insurance_fee || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-secondary">Frequenza mensile</span>
                    <span>€{Number(fee.monthly_fee || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-secondary">Mesi</span>
                    <span>{Number(fee.months_count || 0)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {teamTotals.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="cs-card cs-card--primary">
            <h3 className="font-semibold" style={{ color: 'var(--cs-warning)' }}>Totale da Pagare</h3>
            <p className="text-3xl font-extrabold" style={{ color: 'var(--cs-warning)' }}>
              €{teamTotals.reduce((sum, t) => sum + t.totalAmount, 0).toFixed(2)}
            </p>
          </div>
          <div className="cs-card cs-card--primary">
            <h3 className="font-semibold" style={{ color: 'var(--cs-success)' }}>Già Pagato</h3>
            <p className="text-3xl font-extrabold" style={{ color: 'var(--cs-success)' }}>
              €{teamTotals.reduce((sum, t) => sum + t.paidAmount, 0).toFixed(2)}
            </p>
          </div>
          <div className="cs-card cs-card--primary">
            <h3 className="font-semibold" style={{ color: 'var(--cs-danger)' }}>Ancora da Pagare</h3>
            <p className="text-3xl font-extrabold" style={{ color: 'var(--cs-danger)' }}>
              €{teamTotals.reduce((sum, t) => sum + t.pendingAmount, 0).toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Filters + Lista */}
      <div className="cs-card cs-card--primary">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Dettaglio Rate</h2>
          <div className="flex space-x-2">
            <button onClick={() => setFilter('all')}     aria-pressed={filter==='all'}     className={`cs-btn cs-btn--sm ${filter==='all' ? 'cs-btn--warm'    : 'cs-btn--outline'}`}>Tutte ({installments.length})</button>
            <button onClick={() => setFilter('pending')} aria-pressed={filter==='pending'} className={`cs-btn cs-btn--sm ${filter==='pending' ? 'cs-btn--warning' : 'cs-btn--outline'}`}>Da Pagare</button>
            <button onClick={() => setFilter('paid')}    aria-pressed={filter==='paid'}    className={`cs-btn cs-btn--sm ${filter==='paid' ? 'cs-btn--success'  : 'cs-btn--outline'}`}>Pagate</button>
            <button onClick={() => setFilter('overdue')} aria-pressed={filter==='overdue'} className={`cs-btn cs-btn--sm ${filter==='overdue' ? 'cs-btn--danger'  : 'cs-btn--outline'}`}>Scadute</button>
          </div>
        </div>

        {installments.length === 0 ? (
          <div className="cs-card text-center py-12">
            <p className="text-secondary mb-4">Nessuna quota associativa trovata</p>
            <p className="text-sm text-secondary">Contatta l'amministratore per informazioni sulle quote</p>
          </div>
        ) : filteredInstallments.length === 0 ? (
          <div className="cs-card text-center py-12">
            <p className="text-secondary">Nessuna rata trovata per il filtro selezionato</p>
          </div>
        ) : (
          <div className="cs-card overflow-hidden">
            {/* Desktop */}
            <div className="hidden md:block">
              <table className="cs-table">
                <thead>
                  <tr>
                    <th className="p-4 text-left text-sm font-medium">Descrizione</th>
                    <th className="p-4 text-left text-sm font-medium">Importo</th>
                    <th className="p-4 text-left text-sm font-medium">Stato</th>
                    <th className="p-4 text-left text-sm font-medium">Scadenza</th>
                    <th className="p-4 text-left text-sm font-medium">Riferimento</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInstallments.map((inst) => (
                    <tr key={inst.id}>
                      <td className="p-4">
                        <div className="text-sm font-medium text-secondary">
                          {inst.membership_fee.name} — Rata {inst.installment_number}
                        </div>
                        {inst.membership_fee.description && (
                          <div className="text-xs text-secondary line-clamp-2">{inst.membership_fee.description}</div>
                        )}
                      </td>
                      <td className="p-4 whitespace-nowrap">€{Number(inst.amount).toFixed(2)}</td>
                      <td className="p-4 whitespace-nowrap">
                        <span className={`cs-badge ${statusToBadge(inst.status)}`}>{getStatusText(inst.status)}</span>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-secondary">{new Date(inst.due_date).toLocaleDateString('it-IT')}</div>
                        {inst.paid_at && (
                          <div className="text-sm font-medium text-secondary">Pagata il {new Date(inst.paid_at).toLocaleDateString('it-IT')}</div>
                        )}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-secondary">{inst.membership_fee.team.name} ({inst.membership_fee.team.code})</div>
                        <div className="text-sm font-medium text-secondary">{inst.membership_fee.team.activity.name}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden p-4 space-y-3">
              {filteredInstallments.map((inst) => (
                <div key={inst.id} className="cs-card">
                  <div className="font-semibold">
                    {inst.membership_fee.name} — Rata {inst.installment_number}
                  </div>
                  {inst.membership_fee.description && (
                    <div className="text-sm text-secondary line-clamp-2">{inst.membership_fee.description}</div>
                  )}

                  <div className="mt-2 grid gap-2 text-sm">
                    <div><strong>Importo:</strong> €{Number(inst.amount).toFixed(2)}</div>
                    <div>
                      <strong>Stato:</strong>
                      <span className={`ml-2 cs-badge ${statusToBadge(inst.status)}`}>{getStatusText(inst.status)}</span>
                    </div>
                    <div><strong>Scadenza:</strong> {new Date(inst.due_date).toLocaleDateString('it-IT')}</div>
                    {inst.paid_at && <div><strong>Pagata il:</strong> {new Date(inst.paid_at).toLocaleDateString('it-IT')}</div>}
                    <div className="text-secondary">
                      <strong>Riferimento:</strong> {inst.membership_fee.team.name} ({inst.membership_fee.team.code}) – {inst.membership_fee.team.activity.name}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dettaglio evento opzionale */}
      {selectedEvent && (
        // <EventDetails id={selectedEvent.id} onClose={() => setSelectedEvent(null)} />
        <div /> /* placeholder per evitare errori se il componente non è pronto */
      )}
    </div>
  )
}
