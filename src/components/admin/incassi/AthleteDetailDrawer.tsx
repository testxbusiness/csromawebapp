'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AthleteDetailDrawerProps {
  isOpen: boolean
  onClose: () => void
  athleteId: string | null
}

interface Profile {
  id: string
  first_name: string
  last_name: string
  email: string
  birth_date?: string
  phone?: string
}

interface Team {
  id: string
  name: string
  code: string
}

interface MembershipFee {
  id: string
  name: string
  total_amount: number
  installments_count: number
}

interface Installment {
  id: string
  installment_number: number
  due_date: string
  amount: number
  status: 'not_due' | 'due_soon' | 'overdue' | 'partially_paid' | 'paid'
  paid_at?: string
  notes?: string
  membership_fee?: MembershipFee
}

interface PaymentHistory {
  id: string
  payment_date: string
  amount: number
  method: string
  notes?: string
  installment_number: number
  membership_fee_name: string
}

export default function AthleteDetailDrawer({
  isOpen,
  onClose,
  athleteId
}: AthleteDetailDrawerProps) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [installments, setInstallments] = useState<Installment[]>([])
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'installments' | 'payments'>('overview')

  const supabase = createClient()

  useEffect(() => {
    if (isOpen && athleteId) {
      loadAthleteData()
    } else {
      setProfile(null)
      setTeams([])
      setInstallments([])
      setPaymentHistory([])
    }
  }, [isOpen, athleteId])

  const loadAthleteData = async () => {
    if (!athleteId) return

    setLoading(true)
    try {
      // Load profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', athleteId)
        .single()

      setProfile(profileData)

      // Load teams
      const { data: teamsData } = await supabase
        .from('team_members')
        .select(`
          teams (id, name, code)
        `)
        .eq('profile_id', athleteId)

      setTeams(teamsData?.map(tm => tm.teams) || [])

      // Load installments
      const { data: installmentsData } = await supabase
        .from('fee_installments')
        .select(`
          *,
          membership_fees (id, name, total_amount, installments_count)
        `)
        .eq('profile_id', athleteId)
        .order('due_date')

      setInstallments(installmentsData || [])

      // Load payment history from fee_installments (installments già pagate)
      const { data: paidInstallments } = await supabase
        .from('fee_installments')
        .select(`
          *,
          membership_fees (name)
        `)
        .eq('profile_id', athleteId)
        .eq('status', 'paid')
        .order('paid_at', { ascending: false })

      // Transform installments into payment history format
      const paymentHistoryData = (paidInstallments || []).map(installment => ({
        id: installment.id,
        payment_date: installment.paid_at || '',
        amount: installment.amount,
        method: 'Registrato', // Metodo generico per pagamenti registrati
        notes: installment.notes,
        installment_number: installment.installment_number,
        membership_fee_name: installment.membership_fees?.name || 'Quota Associativa'
      }))

      setPaymentHistory(paymentHistoryData)

    } catch (error) {
      console.error('Errore caricamento dati atleta:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'not_due':
        return 'bg-blue-100 text-blue-800'
      case 'due_soon':
        return 'bg-yellow-100 text-yellow-800'
      case 'overdue':
        return 'bg-red-100 text-red-800'
      case 'partially_paid':
        return 'bg-purple-100 text-purple-800'
      case 'paid':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'not_due':
        return 'Non Scaduta'
      case 'due_soon':
        return 'In Scadenza'
      case 'overdue':
        return 'Scaduta'
      case 'partially_paid':
        return 'Parz. Pagata'
      case 'paid':
        return 'Pagata'
      default:
        return status
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT')
  }

  const calculateTotals = () => {
    const totalAmount = installments.reduce((sum, i) => sum + i.amount, 0)
    const totalPaid = installments.reduce((sum, i) => sum + (i.status === 'paid' ? i.amount : 0), 0)
    const totalRemaining = totalAmount - totalPaid

    const overdueInstallments = installments.filter(i => i.status === 'overdue').length
    const dueSoonInstallments = installments.filter(i => i.status === 'due_soon').length

    return {
      totalAmount,
      totalPaid,
      totalRemaining,
      overdueInstallments,
      dueSoonInstallments
    }
  }

  const totals = calculateTotals()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>

      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Dettaglio Atleta</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-4 bg-gray-200 rounded animate-pulse"></div>
                ))}
              </div>
            ) : profile ? (
              <div className="p-6 space-y-6">
                {/* Profile Info */}
                <div className="space-y-3">
                  <h3 className="text-lg font-medium text-gray-900">
                    {profile.first_name} {profile.last_name}
                  </h3>
                  <div className="text-sm text-gray-600">
                    <div>Email: {profile.email}</div>
                    {profile.phone && <div>Telefono: {profile.phone}</div>}
                    {profile.birth_date && (
                      <div>Data di nascita: {formatDate(profile.birth_date)}</div>
                    )}
                  </div>
                </div>

                {/* Teams */}
                {teams.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Squadre</h4>
                    <div className="space-y-1">
                      {teams.map(team => (
                        <div key={team.id} className="text-sm text-gray-600">
                          {team.name} ({team.code})
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tabs */}
                <div className="border-b border-gray-200">
                  <nav className="flex space-x-8">
                    {[
                      { id: 'overview', label: 'Riepilogo' },
                      { id: 'installments', label: 'Rate' },
                      { id: 'payments', label: 'Pagamenti' }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${
                          activeTab === tab.id
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </nav>
                </div>

                {/* Tab Content */}
                {activeTab === 'overview' && (
                  <div className="space-y-4">
                    {/* Financial Summary */}
                    <div className="cs-card">
                      <h4 className="font-medium mb-3">Riepilogo Finanziario</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-secondary">Totale Dovuto</div>
                          <div className="font-semibold">
                            €{totals.totalAmount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div>
                          <div className="text-secondary">Totale Pagato</div>
                          <div className="font-semibold" style={{color:'var(--cs-success)'}}>
                            €{totals.totalPaid.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div>
                          <div className="text-secondary">Residuo</div>
                          <div className="font-semibold" style={{color:'var(--cs-danger)'}}>
                            €{totals.totalRemaining.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div>
                          <div className="text-secondary">Rate Scadute</div>
                          <div className="font-semibold">{totals.overdueInstallments}</div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div>
                      <h4 className="font-medium mb-3">Azioni Rapide</h4>
                      <div className="space-y-2">
                        <button className="cs-btn cs-btn--primary cs-btn--block">Segna tutte le rate come pagate</button>
                        <button className="cs-btn cs-btn--outline cs-btn--block">Invia promemoria pagamento</button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'installments' && (
                  <div className="cs-list">
                    {installments.map(installment => (
                      <div key={installment.id} className="cs-list-item">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-medium">
                              {installment.membership_fee?.name} - Rata {installment.installment_number}
                            </div>
                            <div className="text-sm text-secondary">
                              Scadenza: {formatDate(installment.due_date)}
                            </div>
                          </div>
                          <span className={`cs-badge ${
                            installment.status==='paid' ? 'cs-badge--success' :
                            installment.status==='overdue' ? 'cs-badge--danger' :
                            installment.status==='due_soon' ? 'cs-badge--warning' :
                            'cs-badge--neutral'
                          }`}>{getStatusLabel(installment.status)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-secondary">Importo:</span>
                            <span className="ml-1 font-medium">
                              €{installment.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div>
                            <span className="text-secondary">Pagato:</span>
                            <span className="ml-1 font-medium">
                              €{(installment.status === 'paid' ? installment.amount : 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                        {installment.notes && (<div className="mt-2 text-sm text-secondary">Note: {installment.notes}</div>)}
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'payments' && (
                  <div className="cs-list">
                    {paymentHistory.length > 0 ? (
                      paymentHistory.map(payment => (
                        <div key={payment.id} className="cs-list-item">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-medium">
                                {payment.membership_fee_name} - Rata {payment.installment_number}
                              </div>
                              <div className="text-sm text-secondary">
                                {formatDate(payment.payment_date)}
                              </div>
                            </div>
                            <span className="font-medium" style={{color:'var(--cs-success)'}}>
                              +€{payment.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="text-sm text-secondary">
                            Metodo: {payment.method}
                          </div>
                          {payment.notes && (<div className="mt-1 text-sm text-secondary">Note: {payment.notes}</div>)}
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-secondary py-8">
                        Nessun pagamento registrato
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-gray-500">
                Atleta non trovato
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
