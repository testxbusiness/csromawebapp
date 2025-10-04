'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { exportToExcel } from '@/lib/utils/excelExport'

interface FinancialData {
  period: string
  revenue: number
  expenses: number
  balance: number
  revenueDetails: {
    category: string
    amount: number
  }[]
  expenseDetails: {
    category: string
    amount: number
  }[]
}

interface Season {
  id: string
  name: string
  start_date: string
  end_date: string
  is_active: boolean
}

interface FilterOptions {
  season_id: string
  gym_id: string
  activity_id: string
  team_id: string
  start_date: string
  end_date: string
}

export default function BalanceReport() {
  const [financialData, setFinancialData] = useState<FinancialData | null>(null)
  const [seasons, setSeasons] = useState<Season[]>([])
  const [gyms, setGyms] = useState<any[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<FilterOptions>({
    season_id: '',
    gym_id: '',
    activity_id: '',
    team_id: '',
    start_date: '',
    end_date: ''
  })
  const supabase = createClient()

  useEffect(() => {
    loadSeasons()
    loadGyms()
    loadActivities()
    loadTeams()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (seasons.length > 0) {
      // Set default to active season
      const activeSeason = seasons.find(s => s.is_active)
      if (activeSeason) {
        setFilters(prev => ({
          ...prev,
          season_id: activeSeason.id,
          start_date: activeSeason.start_date,
          end_date: activeSeason.end_date
        }))
      }
    }
  }, [seasons])

  useEffect(() => {
    if (filters.season_id || filters.start_date) {
      loadFinancialData()
    }
  }, [filters])

  const loadSeasons = async () => {
    const { data } = await supabase
      .from('seasons')
      .select('*')
      .order('start_date', { ascending: false })

    setSeasons(data || [])
  }

  const loadGyms = async () => {
    const { data } = await supabase
      .from('gyms')
      .select('id, name')
      .order('name')

    setGyms(data || [])
  }

  const loadActivities = async () => {
    const { data } = await supabase
      .from('activities')
      .select('id, name')
      .order('name')

    setActivities(data || [])
  }

  const loadTeams = async () => {
    const { data } = await supabase
      .from('teams')
      .select('id, name, code')
      .order('name')

    setTeams(data || [])
  }

  const loadFinancialData = async () => {
    setLoading(true)
    
    try {
      // Calculate revenue from membership fees
      let revenueQuery = supabase
        .from('membership_fees')
        .select('total_amount, teams!inner(name)')

      // Calculate expenses from payments
      let expensesQuery = supabase
        .from('payments')
        .select('amount, type, description')
        .eq('status', 'paid')

      // Apply filters
      if (filters.season_id) {
        // For season filter, we need to get teams in that season first
        const { data: seasonTeams } = await supabase
          .from('teams')
          .select('id')
          .eq('season_id', filters.season_id)

        if (seasonTeams && seasonTeams.length > 0) {
          const teamIds = seasonTeams.map(t => t.id)
          revenueQuery = revenueQuery.in('team_id', teamIds)
          expensesQuery = expensesQuery.in('team_id', teamIds)
        }
      }

      if (filters.team_id) {
        revenueQuery = revenueQuery.eq('team_id', filters.team_id)
        expensesQuery = expensesQuery.eq('team_id', filters.team_id)
      }

      if (filters.start_date && filters.end_date) {
        // For date range filter on payments (assuming created_at for fees)
        expensesQuery = expensesQuery
          .gte('paid_at', filters.start_date)
          .lte('paid_at', filters.end_date)
      }

      const [{ data: revenueData }, { data: expensesData }] = await Promise.all([
        revenueQuery,
        expensesQuery
      ])

      // Calculate totals
      const totalRevenue = revenueData?.reduce((sum, fee) => sum + (fee.total_amount || 0), 0) || 0
      const totalExpenses = expensesData?.reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0

      // Categorize expenses
      const expenseCategories = expensesData?.reduce((acc, payment) => {
        const category = payment.type === 'coach_payment' ? 'Pagamenti Allenatori' : 'Costi Generali'
        acc[category] = (acc[category] || 0) + payment.amount
        return acc
      }, {} as Record<string, number>) || {}

      const expenseDetails = Object.entries(expenseCategories).map(([category, amount]) => ({
        category,
        amount
      }))

      // For revenue, we can categorize by team
      const revenueByTeam = revenueData?.reduce((acc, fee) => {
        const teamName = fee.teams?.name || 'Sconosciuto'
        acc[teamName] = (acc[teamName] || 0) + (fee.total_amount || 0)
        return acc
      }, {} as Record<string, number>) || {}

      const revenueDetails = Object.entries(revenueByTeam).map(([category, amount]) => ({
        category,
        amount
      }))

      const period = filters.season_id 
        ? seasons.find(s => s.id === filters.season_id)?.name || 'Periodo selezionato'
        : 'Periodo personalizzato'

      setFinancialData({
        period,
        revenue: totalRevenue,
        expenses: totalExpenses,
        balance: totalRevenue - totalExpenses,
        revenueDetails,
        expenseDetails
      })

    } catch (error) {
      console.error('Error loading financial data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (field: keyof FilterOptions, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const exportToExcelReport = () => {
    if (!financialData) return

    const reportData = [
      { Category: 'PERIODO', Amount: financialData.period, Notes: '' },
      { Category: '', Amount: '', Notes: '' },
      { Category: 'ENTRATE', Amount: `€${financialData.revenue.toFixed(2)}`, Notes: '' },
      ...financialData.revenueDetails.map(item => ({
        Category: `  ${item.category}`,
        Amount: `€${item.amount.toFixed(2)}`,
        Notes: ''
      })),
      { Category: '', Amount: '', Notes: '' },
      { Category: 'USCITE', Amount: `€${financialData.expenses.toFixed(2)}`, Notes: '' },
      ...financialData.expenseDetails.map(item => ({
        Category: `  ${item.category}`,
        Amount: `€${item.amount.toFixed(2)}`,
        Notes: ''
      })),
      { Category: '', Amount: '', Notes: '' },
      { Category: 'BILANCIO', Amount: `€${financialData.balance.toFixed(2)}`, Notes: financialData.balance >= 0 ? 'ATTIVO' : 'PASSIVO' }
    ]

    exportToExcel(reportData, [
      { key: 'Category', title: 'Voce', width: 30 },
      { key: 'Amount', title: 'Importo', width: 15 },
      { key: 'Notes', title: 'Note', width: 20 }
    ], {
      filename: `bilancio_csroma_${filters.season_id || 'custom'}`,
      sheetName: 'Bilancio',
      headerStyle: { fill: { fgColor: { rgb: '2E86C1' } } }
    })
  }

  const getBalanceColor = (balance: number) => {
    return balance >= 0 ? 'text-green-600' : 'text-red-600'
  }

  const getBalanceIcon = (balance: number) => {
    return balance >= 0 ? '📈' : '📉'
  }

  if (loading && !financialData) {
    return <div className="p-4">Caricamento report finanziario...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Report Bilancio Finanziario</h2>
        <div className="flex gap-3">
          <button onClick={exportToExcelReport} className="cs-btn cs-btn--outline" disabled={!financialData}>
            <span className="mr-2">📊</span>
            Export Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="cs-card p-6">
        <h3 className="text-lg font-semibold mb-4">Filtri Report</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="cs-field__label">Stagione</label>
            <select
              value={filters.season_id}
              onChange={(e) => handleFilterChange('season_id', e.target.value)}
              className="cs-select"
            >
              <option value="">Tutte le stagioni</option>
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name} {season.is_active && '(Attiva)'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="cs-field__label">Palestra</label>
            <select
              value={filters.gym_id}
              onChange={(e) => handleFilterChange('gym_id', e.target.value)}
              className="cs-select"
            >
              <option value="">Tutte le palestre</option>
              {gyms.map((gym) => (
                <option key={gym.id} value={gym.id}>{gym.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="cs-field__label">Attività</label>
            <select
              value={filters.activity_id}
              onChange={(e) => handleFilterChange('activity_id', e.target.value)}
              className="cs-select"
            >
              <option value="">Tutte le attività</option>
              {activities.map((activity) => (
                <option key={activity.id} value={activity.id}>{activity.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="cs-field__label">Squadra</label>
            <select
              value={filters.team_id}
              onChange={(e) => handleFilterChange('team_id', e.target.value)}
              className="cs-select"
            >
              <option value="">Tutte le squadre</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>{team.name} ({team.code})</option>
              ))}
            </select>
          </div>
        </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="cs-field__label">Data Inizio</label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
                className="cs-input"
              />
            </div>
            <div>
              <label className="cs-field__label">Data Fine</label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
                className="cs-input"
              />
            </div>
          </div>

          <button onClick={loadFinancialData} className="mt-4 cs-btn cs-btn--primary">Aggiorna Report</button>
      </div>

      {financialData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="cs-card text-center">
              <div className="text-2xl font-bold" style={{color:'var(--cs-success)'}}>
                €{financialData.revenue.toFixed(2)}
              </div>
              <div className="text-sm text-secondary mt-1">Entrate Totali</div>
              <div className="text-xs text-secondary mt-2">
                {financialData.revenueDetails.length} fonti di entrata
              </div>
            </div>

            <div className="cs-card text-center">
              <div className="text-2xl font-bold" style={{color:'var(--cs-danger)'}}>
                €{financialData.expenses.toFixed(2)}
              </div>
              <div className="text-sm text-secondary mt-1">Uscite Totali</div>
              <div className="text-xs text-secondary mt-2">
                {financialData.expenseDetails.length} categorie di spesa
              </div>
            </div>

            <div className="cs-card text-center">
              <div className={`text-2xl font-bold ${getBalanceColor(financialData.balance)}`}>
                {getBalanceIcon(financialData.balance)} €{Math.abs(financialData.balance).toFixed(2)}
              </div>
              <div className="text-sm text-secondary mt-1">
                Bilancio {financialData.balance >= 0 ? 'Attivo' : 'Passivo'}
              </div>
              <div className="text-xs text-secondary mt-2">
                Periodo: {financialData.period}
              </div>
            </div>
          </div>

          {/* Detailed Reports */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Breakdown */}
            <div className="cs-card">
              <h3 className="text-lg font-semibold mb-4 text-green-700">
                📈 Dettaglio Entrate
              </h3>
              <div className="space-y-3">
                {financialData.revenueDetails.map((item, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-sm">{item.category}</span>
                    <span className="text-sm font-semibold" style={{color:'var(--cs-success)'}}>
                      €{item.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between items-center font-semibold">
                    <span>TOTALE ENTRATE</span>
                    <span style={{color:'var(--cs-success)'}}>
                      €{financialData.revenue.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Expenses Breakdown */}
            <div className="cs-card">
              <h3 className="text-lg font-semibold mb-4 text-red-700">
                📉 Dettaglio Uscite
              </h3>
              <div className="space-y-3">
                {financialData.expenseDetails.map((item, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-sm">{item.category}</span>
                    <span className="text-sm font-semibold" style={{color:'var(--cs-danger)'}}>
                      €{item.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between items-center font-semibold">
                    <span>TOTALE USCITE</span>
                    <span style={{color:'var(--cs-danger)'}}>
                      €{financialData.expenses.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Health Indicator */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">📊 Salute Finanziaria</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Margine Operativo:</span>
                <span className={`text-sm font-semibold ${getBalanceColor(financialData.balance)}`}>
                  {financialData.balance >= 0 ? '+' : ''}€{financialData.balance.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Percentuale di Profitto:</span>
                <span className={`text-sm font-semibold ${getBalanceColor(financialData.balance)}`}>
                  {financialData.revenue > 0 
                    ? `${((financialData.balance / financialData.revenue) * 100).toFixed(1)}%` 
                    : 'N/A'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Rapporto Entrate/Uscite:</span>
                <span className="text-sm font-semibold text-gray-800">
                  {financialData.expenses > 0 
                    ? (financialData.revenue / financialData.expenses).toFixed(2) 
                    : '∞'
                  }:1
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {!financialData && !loading && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-gray-500 mb-4">
            <span className="text-4xl">📊</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Nessun dato finanziario disponibile
          </h3>
          <p className="text-gray-600">
            Seleziona i filtri e genera il report per visualizzare il bilancio finanziario.
          </p>
        </div>
      )}
    </div>
  )
}
