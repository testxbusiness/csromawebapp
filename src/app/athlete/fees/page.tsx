'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import PageHeader from '@/components/shared/PageHeader'

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
      activity: {
        name: string
      }
    }
  }
}

export default function AthleteFeesPage() {
  const { user, profile } = useAuth()
  const [installments, setInstallments] = useState<FeeInstallment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, pending, paid, overdue
  const [filteredInstallments, setFilteredInstallments] = useState<FeeInstallment[]>([])
  const supabase = createClient()
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

  useEffect(() => {
    if (user) {
      loadInstallments()
    }
  }, [user])

  useEffect(() => {
    filterInstallments()
  }, [installments, filter])

  const loadInstallments = async () => {
    setLoading(true)
    try {
      // 1) Base installments (no joins)
      const { data: base, error: baseErr } = await supabase
        .from('fee_installments')
        .select('id, installment_number, due_date, amount, status, paid_at, membership_fee_id')
        .eq('profile_id', user?.id)
        .order('due_date', { ascending: true })

      if (baseErr) {
        console.error('Error loading fee installments (athlete):', baseErr)
        setInstallments([])
        return
      }

      const feeIds = [...new Set((base || []).map((r: any) => r.membership_fee_id).filter(Boolean))]
      if (feeIds.length === 0) {
        setInstallments([])
        return
      }

      // 2) Membership fees
      const { data: fees, error: feesErr } = await supabase
        .from('membership_fees')
        .select('id, team_id, name, description, total_amount, enrollment_fee, insurance_fee, monthly_fee, months_count, installments_count')
        .in('id', feeIds)

      if (feesErr) {
        console.error('Error loading membership fees:', feesErr)
        setInstallments([])
        return
      }

      const teamIds = [...new Set((fees || []).map((f: any) => f.team_id).filter(Boolean))]
      let teams: any[] = []
      if (teamIds.length > 0) {
        const { data: ts } = await supabase
          .from('teams')
          .select('id, name, code, activity_id')
          .in('id', teamIds)
        teams = ts || []
      }

      const activityIds = [...new Set(teams.map((t: any) => t.activity_id).filter(Boolean))]
      let activities: any[] = []
      if (activityIds.length > 0) {
        const { data: acts } = await supabase
          .from('activities')
          .select('id, name')
          .in('id', activityIds)
        activities = acts || []
      }

      const feeMap = new Map((fees || []).map((f: any) => [f.id, f]))
      const teamMap = new Map(teams.map((t: any) => [t.id, t]))
      const activityMap = new Map(activities.map((a: any) => [a.id, a]))

      const composed: FeeInstallment[] = (base || []).map((row: any) => {
        const fee = feeMap.get(row.membership_fee_id)
        const team = fee ? teamMap.get(fee.team_id) : null
        const activity = team ? activityMap.get(team.activity_id) : null
        return {
          id: row.id,
          installment_number: row.installment_number,
          due_date: row.due_date,
          amount: row.amount,
          status: row.status,
          paid_at: row.paid_at || undefined,
          membership_fee: {
            id: fee?.id,
            name: fee?.name || 'Quota',
            description: fee?.description || undefined,
            total_amount: fee?.total_amount || 0,
            enrollment_fee: fee?.enrollment_fee || 0,
            insurance_fee: fee?.insurance_fee || 0,
            monthly_fee: fee?.monthly_fee || 0,
            months_count: fee?.months_count || 0,
            installments_count: fee?.installments_count || 1,
            team: {
              name: team?.name || 'N/D',
              code: team?.code || 'N/D',
              activity: { name: activity?.name || 'N/D' }
            }
          }
        }
      })

      setInstallments(composed)
    } finally {
      setLoading(false)
    }
  }

  const filterInstallments = () => {
    let filtered = installments

    switch (filter) {
      case 'pending':
        filtered = installments.filter(inst => inst.status !== 'paid')
        break
      case 'paid':
        filtered = installments.filter(inst => inst.status === 'paid')
        break
      case 'overdue':
        filtered = installments.filter(inst => inst.status === 'overdue')
        break
      default:
        filtered = installments
    }

    setFilteredInstallments(filtered)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800'
      case 'overdue':
        return 'bg-red-100 text-red-800'
      case 'due_soon':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid':
        return '✅ Pagata'
      case 'overdue':
        return '❌ Scaduta'
      case 'due_soon':
        return '⚠️ In Scadenza'
      case 'not_due':
        return '⏳ Non Scaduta'
      default:
        return status
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return '✅'
      case 'overdue':
        return '❌'
      case 'due_soon':
        return '⚠️'
      default:
        return '⏳'
    }
  }

  const getTotalsByTeam = () => {
    const teamTotals = new Map()
    
    installments.forEach(inst => {
      const teamName = inst.membership_fee.team.name
      if (!teamTotals.has(teamName)) {
        teamTotals.set(teamName, {
          team: inst.membership_fee.team,
          totalAmount: 0,
          paidAmount: 0,
          pendingAmount: 0,
          installments: []
        })
      }
      
      const teamData = teamTotals.get(teamName)
      teamData.totalAmount += inst.amount
      teamData.installments.push(inst)
      
      if (inst.status === 'paid') {
        teamData.paidAmount += inst.amount
      } else {
        teamData.pendingAmount += inst.amount
      }
    })
    
    return Array.from(teamTotals.values())
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const teamTotals = getTotalsByTeam()

  return (
    <>
      <PageHeader title="Le Mie Quote Associative" subtitle="Area Atleta" />
      <div className="space-y-6">
          {/* Summary Cards */}
          {teamTotals.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="cs-card">
                <h3 className="font-semibold text-blue-900" style={{ color: 'var(--cs-warning)' }}>Totale da Pagare</h3>
                <p className="text-3xl font-extrabold" style={{ color: 'var(--cs-warning)' }}>
                  €{teamTotals.reduce((sum, team) => sum + team.totalAmount, 0).toFixed(2)}
                </p>
              </div>
              <div className="cs-card">
                <h3 className="font-semibold text-green-900" style={{ color: 'var(--cs-success)' }}>Già Pagato</h3>
                <p className="text-3xl font-extrabold" style={{ color: 'var(--cs-success)' }}>
                  €{teamTotals.reduce((sum, team) => sum + team.paidAmount, 0).toFixed(2)}
                </p>
              </div>
              <div className="cs-card">
                <h3 className="font-semibold text-orange-900" style={{ color: 'var(--cs-danger)' }}>Ancora da Pagare</h3>
                <p className="text-3xl font-extrabold" style={{ color: 'var(--cs-danger)' }}>
                  €{teamTotals.reduce((sum, team) => sum + team.pendingAmount, 0).toFixed(2)}
                </p>
              </div>
            </div>
          )}

          {/* Filters */}
<div className="cs-card">
  <div className="flex justify-between items-center mb-4">
    <h2 className="text-xl font-semibold">Dettaglio Rate</h2>
    <div className="flex space-x-2">
      <button
        onClick={() => setFilter('all')}
        aria-pressed={filter==='all'}
        className={`cs-btn cs-btn--sm ${filter === 'all' ? 'cs-btn--warm' : 'cs-btn--outline'}`}
      >
        Tutte ({installments.length})
      </button>

      <button
        onClick={() => setFilter('pending')}
        aria-pressed={filter==='pending'}
        className={`cs-btn cs-btn--sm ${filter === 'pending' ? 'cs-btn--warning' : 'cs-btn--outline'}`}
      >
        Da Pagare
      </button>

      <button
        onClick={() => setFilter('paid')}
        aria-pressed={filter==='paid'}
        className={`cs-btn cs-btn--sm ${filter === 'paid' ? 'cs-btn--success' : 'cs-btn--outline'}`}
      >
        Pagate
      </button>

      <button
        onClick={() => setFilter('overdue')}
        aria-pressed={filter==='overdue'}
        className={`cs-btn cs-btn--sm ${filter === 'overdue' ? 'cs-btn--danger' : 'cs-btn--outline'}`}
      >
        Scadute
      </button>
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
                <div className="text-xs text-secondary line-clamp-2">
                  {inst.membership_fee.description}
                </div>
              )}
            </td>

            <td className="p-4 whitespace-nowrap">
              €{Number(inst.amount).toFixed(2)}
            </td>

            <td className="p-4 whitespace-nowrap">
              <span className={`cs-badge ${statusToBadge(inst.status)}`}>
                {getStatusText(inst.status)}
              </span>
            </td>

            <td className="p-4 whitespace-nowrap">
              <div className="text-sm font-medium text-secondary">
                {new Date(inst.due_date).toLocaleDateString('it-IT')}
              </div>
              {inst.paid_at && (
                <div className="text-sm font-medium text-secondary">
                  Pagata il {new Date(inst.paid_at).toLocaleDateString('it-IT')}
                </div>
              )}
            </td>

            <td className="p-4 whitespace-nowrap">
              <div className="text-sm font-medium text-secondary">
                {inst.membership_fee.team.name} ({inst.membership_fee.team.code})
              </div>
              <div className="text-sm font-medium text-secondary">
                {inst.membership_fee.team.activity.name}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
            )}
          </div>
        </div>

      {selectedEvent && (
        <EventDetails id={selectedEvent.id} onClose={() => setSelectedEvent(null)} />
      )}
    </>
  )
}
