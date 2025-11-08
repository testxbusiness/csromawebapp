'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import KPICards from './incassi/KPICards'
import FilterBar from './incassi/FilterBar'
import InstallmentsTable from './incassi/InstallmentsTable'
import BulkActionsBar from './incassi/BulkActionsBar'
import PaymentModal from './incassi/PaymentModal'
import { toast } from '@/components/ui'
import AthleteDetailDrawer from './incassi/AthleteDetailDrawer'

interface Installment {
  id: string
  membership_fee_id: string
  profile_id: string
  installment_number: number
  due_date: string
  amount: number
  status: 'not_due' | 'due_soon' | 'overdue' | 'partially_paid' | 'paid'
  paid_at?: string
  notes?: string

  // Enriched data
  profile?: {
    id: string
    first_name: string
    last_name: string
    email: string
  }
  membership_fee?: {
    id: string
    name: string
    team_id: string
  }
  team?: {
    id: string
    name: string
    code: string
  }
}

interface KPIData {
  not_due: number
  due_soon: number
  overdue: number
  partially_paid: number
  paid: number
  total_amount: number
  total_paid: number
}

interface FilterState {
  teams: string[]
  plans: string[]
  status: string[]
  dateRange: {
    from: string
    to: string
  }
  search: string
  preset: 'today' | '7days' | '30days' | 'custom' | null
}

interface PaginationState {
  page: number
  limit: number
  total: number
}

export default function InstallmentsManager() {
  const [installments, setInstallments] = useState<Installment[]>([])
  const [kpiData, setKpiData] = useState<KPIData>({
    not_due: 0,
    due_soon: 0,
    overdue: 0,
    partially_paid: 0,
    paid: 0,
    total_amount: 0,
    total_paid: 0
  })
  const [loading, setLoading] = useState(true)
  const [selectedInstallments, setSelectedInstallments] = useState<Set<string>>(new Set())
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedAthlete, setSelectedAthlete] = useState<string | null>(null)
  const [showAthleteDetail, setShowAthleteDetail] = useState(false)

  const [filters, setFilters] = useState<FilterState>({
    teams: [],
    plans: [],
    status: [],
    dateRange: { from: '', to: '' },
    search: '',
    preset: null
  })

  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 50,
    total: 0
  })

  const supabase = createClient()

  // Load KPI data
  const loadKPIData = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/incassi/kpi')
      const result = await response.json()

      if (response.ok) {
        setKpiData(result.data)
      }
    } catch (error) {
      console.error('Errore caricamento KPI:', error)
    }
  }, [])

  // Load installments with filters and pagination
  const loadInstallments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()

      // Add filters
      if (filters.teams.length > 0) {
        params.set('teams', filters.teams.join(','))
      }
      if (filters.plans.length > 0) {
        params.set('plans', filters.plans.join(','))
      }
      if (filters.status.length > 0) {
        params.set('status', filters.status.join(','))
      }
      if (filters.dateRange.from) {
        params.set('from', filters.dateRange.from)
      }
      if (filters.dateRange.to) {
        params.set('to', filters.dateRange.to)
      }
      if (filters.search) {
        params.set('search', filters.search)
      }
      if (filters.preset) {
        params.set('preset', filters.preset)
      }

      // Add pagination
      params.set('page', pagination.page.toString())
      params.set('limit', pagination.limit.toString())

      const response = await fetch(`/api/admin/incassi/installments?${params.toString()}`)
      const result = await response.json()

      if (response.ok) {
        setInstallments(result.installments)
        setPagination(prev => ({ ...prev, total: result.total }))
      }
    } catch (error) {
      console.error('Errore caricamento rate:', error)
    } finally {
      setLoading(false)
    }
  }, [filters, pagination.page, pagination.limit])

  // Load data on mount and when filters change
  useEffect(() => {
    loadKPIData()
  }, [loadKPIData])

  useEffect(() => {
    loadInstallments()
  }, [loadInstallments])

  // Handle KPI card click
  const handleKPIClick = (status: string) => {
    setFilters(prev => ({
      ...prev,
      status: status === 'all' ? [] : [status]
    }))
  }

  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
    setPagination(prev => ({ ...prev, page: 1 })) // Reset to first page
  }

  // Handle pagination
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }))
  }

  // Handle installment selection
  const toggleInstallmentSelection = (installmentId: string) => {
    setSelectedInstallments(prev => {
      const newSelection = new Set(prev)
      if (newSelection.has(installmentId)) {
        newSelection.delete(installmentId)
      } else {
        newSelection.add(installmentId)
      }
      return newSelection
    })
  }

  const selectAllInstallments = () => {
    if (selectedInstallments.size === installments.length) {
      setSelectedInstallments(new Set())
    } else {
      setSelectedInstallments(new Set(installments.map(i => i.id)))
    }
  }

  // Handle bulk payment marking
  const handleBulkPayment = () => {
    if (selectedInstallments.size === 0) return
    setShowPaymentModal(true)
  }

  // Handle payment confirmation
  const handlePaymentConfirm = async (paymentData: {
    paymentDate: string
    paymentMethod: string
  }) => {
    try {
      const response = await fetch('/api/admin/incassi/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          installmentIds: Array.from(selectedInstallments),
          ...paymentData
        })
      })

      const result = await response.json()

      if (response.ok) {
        setShowPaymentModal(false)
        setSelectedInstallments(new Set())
        await loadKPIData()
        await loadInstallments()
        import('@/components/ui/Toast').then(({ toast }) => toast.success(result.message)).catch(()=>{})
      } else {
        import('@/components/ui/Toast').then(({ toast }) => toast.error(`Errore: ${result.error}`)).catch(()=>{})
      }
    } catch (error) {
      console.error('Errore durante il pagamento:', error)
      import('@/components/ui/Toast').then(({ toast }) => toast.error('Errore di rete durante il pagamento')).catch(()=>{})
    }
  }

  // Handle athlete detail view
  const handleAthleteClick = (athleteId: string) => {
    setSelectedAthlete(athleteId)
    setShowAthleteDetail(true)
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <KPICards
        data={kpiData}
        onCardClick={handleKPIClick}
        loading={loading}
      />

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={() => setFilters({
          teams: [],
          plans: [],
          status: [],
          dateRange: { from: '', to: '' },
          search: '',
          preset: null
        })}
      />

      {/* Installments Table */}
      <InstallmentsTable
        installments={installments}
        loading={loading}
        selectedInstallments={selectedInstallments}
        onInstallmentSelect={toggleInstallmentSelection}
        onSelectAll={selectAllInstallments}
        onAthleteClick={handleAthleteClick}
        pagination={pagination}
        onPageChange={handlePageChange}
      />

      {/* Bulk Actions Bar */}
      {selectedInstallments.size > 0 && (
        <BulkActionsBar
          selectedCount={selectedInstallments.size}
          totalCount={pagination.total}
          onBulkPayment={handleBulkPayment}
          onSelectAll={() => {
            // This would select all installments matching current filters
            // Implementation would require loading all IDs
          }}
        />
      )}

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onConfirm={handlePaymentConfirm}
        selectedInstallments={installments.filter(i => selectedInstallments.has(i.id))}
      />

      {/* Athlete Detail Drawer */}
      <AthleteDetailDrawer
        isOpen={showAthleteDetail}
        onClose={() => {
          setShowAthleteDetail(false)
          setSelectedAthlete(null)
        }}
        athleteId={selectedAthlete}
      />
    </div>
  )
}
