'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface BalanceSummary {
  actual: {
    income: number
    expenses: number
    balance: number
  }
  forecast: {
    income: number
    expenses: number
    balance: number
  }
  outstanding: {
    income: number
    expenses: number
    balance: number
  }
  total: {
    income: number
    expenses: number
    balance: number
  }
}

interface BalanceData {
  season: {
    id: string
    name: string
  }
  summary: BalanceSummary
  details: {
    installments: any[]
    payments: any[]
  }
}

interface FilterOptions {
  activities: any[]
  teams: any[]
  gyms: any[]
  coaches: any[]
}

export default function BalanceDashboard() {
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    activities: [],
    teams: [],
    gyms: [],
    coaches: []
  })
  const [filters, setFilters] = useState({
    activityId: '',
    teamId: '',
    gymId: '',
    userId: '',
    startDate: '',
    endDate: ''
  })
  const supabase = createClient()

  useEffect(() => {
    loadFilterOptions()
    loadBalanceData()
  }, [filters])

  const loadFilterOptions = async () => {
    try {
      const [activitiesRes, teamsRes, gymsRes, coachesRes] = await Promise.all([
        supabase.from('activities').select('id, name').order('name'),
        supabase.from('teams').select('id, name, code').order('name'),
        supabase.from('gyms').select('id, name').order('name'),
        supabase.from('profiles').select('id, first_name, last_name').eq('role', 'coach').order('first_name')
      ])

      setFilterOptions({
        activities: activitiesRes.data || [],
        teams: teamsRes.data || [],
        gyms: gymsRes.data || [],
        coaches: coachesRes.data || []
      })
    } catch (error) {
      console.error('Error loading filter options:', error)
    }
  }

  const loadBalanceData = async () => {
    try {
      setLoading(true)
      const queryParams = new URLSearchParams()
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value)
      })

      const response = await fetch(`/api/admin/balance?${queryParams}`)
      
      if (!response.ok) {
        throw new Error('Failed to load balance data')
      }

      const data = await response.json()
      setBalanceData(data)
    } catch (error) {
      console.error('Error loading balance data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount)
  }

  const getBalanceColor = (amount: number) => {
    if (amount > 0) return 'text-[color:var(--cs-success)]'
    if (amount < 0) return 'text-[color:var(--cs-danger)]'
    return 'text-secondary'
  }

  if (loading) {
    return (
      <div className="cs-card p-6">
        <div className="cs-skeleton h-8 w-1/4 mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="cs-card p-4">
              <div className="cs-skeleton h-5 w-2/3 mb-2"></div>
              <div className="cs-skeleton h-4 w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="cs-card cs-card--primary p-6">
        <h3 className="text-lg font-semibold mb-4">Filtri</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="cs-field__label">Attività</label>
            <select
              value={filters.activityId}
              onChange={(e) => handleFilterChange('activityId', e.target.value)}
              className="cs-select"
            >
              <option value="">Tutte le attività</option>
              {filterOptions.activities.map((activity) => (
                <option key={activity.id} value={activity.id}>
                  {activity.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="cs-field__label">Squadra</label>
            <select
              value={filters.teamId}
              onChange={(e) => handleFilterChange('teamId', e.target.value)}
              className="cs-select"
            >
              <option value="">Tutte le squadre</option>
              {filterOptions.teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name} ({team.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="cs-field__label">Palestra</label>
            <select
              value={filters.gymId}
              onChange={(e) => handleFilterChange('gymId', e.target.value)}
              className="cs-select"
            >
              <option value="">Tutte le palestre</option>
              {filterOptions.gyms.map((gym) => (
                <option key={gym.id} value={gym.id}>
                  {gym.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="cs-field__label">Allenatore</label>
            <select
              value={filters.userId}
              onChange={(e) => handleFilterChange('userId', e.target.value)}
              className="cs-select"
            >
              <option value="">Tutti gli allenatori</option>
              {filterOptions.coaches.map((coach) => (
                <option key={coach.id} value={coach.id}>
                  {coach.first_name} {coach.last_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="cs-field__label">Da Data</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="cs-input"
            />
          </div>

          <div>
            <label className="cs-field__label">A Data</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="cs-input"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => setFilters({
              activityId: '',
              teamId: '',
              gymId: '',
              userId: '',
              startDate: '',
              endDate: ''
            })}
            className="cs-btn cs-btn--ghost"
          >
            Reset Filtri
          </button>
        </div>
      </div>

      {/* Balance Summary */}
      {balanceData && (
        <div className="cs-card cs-card--primary p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">
              Bilancio - {balanceData.season.name}
            </h2>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {/* Actual */}
            <div className="cs-card">
              <h3 className="text-lg font-semibold mb-2">Consuntivo</h3>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm">Entrate:</span>
                  <span className="text-sm font-medium" style={{color:'var(--cs-success)'}}>
                    {formatCurrency(balanceData.summary.actual.income)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Uscite:</span>
                  <span className="text-sm font-medium" style={{color:'var(--cs-danger)'}}>
                    {formatCurrency(balanceData.summary.actual.expenses)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-1">
                  <span className="text-sm font-medium">Bilancio:</span>
                  <span className={`text-sm font-bold ${getBalanceColor(balanceData.summary.actual.balance)}`}>
                    {formatCurrency(balanceData.summary.actual.balance)}
                  </span>
                </div>
              </div>
            </div>

            {/* Forecast */}
            <div className="cs-card">
              <h3 className="text-lg font-semibold mb-2">Forecast</h3>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm">Entrate:</span>
                  <span className="text-sm font-medium" style={{color:'var(--cs-success)'}}>
                    {formatCurrency(balanceData.summary.forecast.income)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Uscite:</span>
                  <span className="text-sm font-medium" style={{color:'var(--cs-danger)'}}>
                    {formatCurrency(balanceData.summary.forecast.expenses)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-1">
                  <span className="text-sm font-medium">Bilancio:</span>
                  <span className={`text-sm font-bold ${getBalanceColor(balanceData.summary.forecast.balance)}`}>
                    {formatCurrency(balanceData.summary.forecast.balance)}
                  </span>
                </div>
              </div>
            </div>

            {/* Outstanding */}
            <div className="cs-card">
              <h3 className="text-lg font-semibold mb-2">Outstanding</h3>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm">Entrate:</span>
                  <span className="text-sm font-medium text-yellow-800">
                    {formatCurrency(balanceData.summary.outstanding.income)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Uscite:</span>
                  <span className="text-sm font-medium text-yellow-800">
                    {formatCurrency(balanceData.summary.outstanding.expenses)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-1">
                  <span className="text-sm font-medium">Bilancio:</span>
                  <span className={`text-sm font-bold ${getBalanceColor(balanceData.summary.outstanding.balance)}`}>
                    {formatCurrency(balanceData.summary.outstanding.balance)}
                  </span>
                </div>
              </div>
            </div>

            {/* Total */}
            <div className="cs-card p-4">
              <h3 className="text-lg font-semibold mb-2">Totale</h3>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm text-secondary">Entrate:</span>
                  <span className="text-sm font-medium">
                    {formatCurrency(balanceData.summary.total.income)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-secondary">Uscite:</span>
                  <span className="text-sm font-medium">
                    {formatCurrency(balanceData.summary.total.expenses)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-1">
                  <span className="text-sm font-medium">Bilancio:</span>
                  <span className={`text-sm font-bold ${getBalanceColor(balanceData.summary.total.balance)}`}>
                    {formatCurrency(balanceData.summary.total.balance)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Income Breakdown */}
            <div className="cs-card">
              <h4 className="text-lg font-semibold mb-3">Dettaglio Entrate</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-secondary">Consuntivo:</span>
                  <span className="text-sm font-medium" style={{color:'var(--cs-success)'}}>
                    {formatCurrency(balanceData.summary.actual.income)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-secondary">Forecast:</span>
                  <span className="text-sm font-medium" style={{color:'var(--cs-success)'}}>
                    {formatCurrency(balanceData.summary.forecast.income)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-secondary">Outstanding:</span>
                  <span className="text-sm font-medium" style={{color:'var(--cs-warning)'}}>
                    {formatCurrency(balanceData.summary.outstanding.income)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-sm font-medium">Totale Entrate:</span>
                  <span className="text-sm font-bold">
                    {formatCurrency(balanceData.summary.total.income)}
                  </span>
                </div>
              </div>
            </div>

            {/* Expenses Breakdown */}
            <div className="cs-card">
              <h4 className="text-lg font-semibold mb-3">Dettaglio Uscite</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-secondary">Consuntivo:</span>
                  <span className="text-sm font-medium" style={{color:'var(--cs-danger)'}}>
                    {formatCurrency(balanceData.summary.actual.expenses)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-secondary">Forecast:</span>
                  <span className="text-sm font-medium" style={{color:'var(--cs-danger)'}}>
                    {formatCurrency(balanceData.summary.forecast.expenses)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-secondary">Outstanding:</span>
                  <span className="text-sm font-medium" style={{color:'var(--cs-warning)'}}>
                    {formatCurrency(balanceData.summary.outstanding.expenses)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-sm font-medium">Totale Uscite:</span>
                  <span className="text-sm font-bold">
                    {formatCurrency(balanceData.summary.total.expenses)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
