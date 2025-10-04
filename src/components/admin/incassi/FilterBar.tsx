'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface FilterBarProps {
  filters: {
    teams: string[]
    plans: string[]
    status: string[]
    dateRange: { from: string; to: string }
    search: string
    preset: 'today' | '7days' | '30days' | 'custom' | null
  }
  onFilterChange: (filters: any) => void
  onClearFilters: () => void
}

interface Team {
  id: string
  name: string
  code: string
}

interface MembershipFee {
  id: string
  name: string
  team_id: string
}

export default function FilterBar({ filters, onFilterChange, onClearFilters }: FilterBarProps) {
  const [teams, setTeams] = useState<Team[]>([])
  const [plans, setPlans] = useState<MembershipFee[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)

  const supabase = createClient()

  // Load teams and plans
  useEffect(() => {
    const loadData = async () => {
      // Load teams
      const { data: teamsData } = await supabase
        .from('teams')
        .select('id, name, code')
        .order('name')

      // Load membership fees
      const { data: plansData } = await supabase
        .from('membership_fees')
        .select('id, name, team_id')
        .order('name')

      setTeams(teamsData || [])
      setPlans(plansData || [])
    }

    loadData()
  }, [supabase])

  const statusOptions = [
    { value: 'not_due', label: 'Non Scadute', color: 'bg-blue-100 text-blue-800' },
    { value: 'due_soon', label: 'In Scadenza', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'overdue', label: 'Scadute', color: 'bg-red-100 text-red-800' },
    { value: 'partially_paid', label: 'Parz. Pagate', color: 'bg-purple-100 text-purple-800' },
    { value: 'paid', label: 'Pagate', color: 'bg-green-100 text-green-800' }
  ]

  const presetOptions = [
    { value: 'today', label: 'Oggi' },
    { value: '7days', label: 'Prossimi 7 giorni' },
    { value: '30days', label: 'Prossimi 30 giorni' },
    { value: 'custom', label: 'Personalizzato' }
  ]

  const handleTeamChange = (teamId: string) => {
    const newTeams = filters.teams.includes(teamId)
      ? filters.teams.filter(id => id !== teamId)
      : [...filters.teams, teamId]

    onFilterChange({ teams: newTeams })
  }

  const handlePlanChange = (planId: string) => {
    const newPlans = filters.plans.includes(planId)
      ? filters.plans.filter(id => id !== planId)
      : [...filters.plans, planId]

    onFilterChange({ plans: newPlans })
  }

  const handleStatusChange = (status: string) => {
    const newStatus = filters.status.includes(status)
      ? filters.status.filter(s => s !== status)
      : [...filters.status, status]

    onFilterChange({ status: newStatus })
  }

  const handlePresetChange = (preset: string) => {
    const today = new Date()
    let from = ''
    let to = ''

    switch (preset) {
      case 'today':
        from = today.toISOString().split('T')[0]
        to = from
        break
      case '7days':
        from = today.toISOString().split('T')[0]
        const in7Days = new Date(today)
        in7Days.setDate(today.getDate() + 7)
        to = in7Days.toISOString().split('T')[0]
        break
      case '30days':
        from = today.toISOString().split('T')[0]
        const in30Days = new Date(today)
        in30Days.setDate(today.getDate() + 30)
        to = in30Days.toISOString().split('T')[0]
        break
      case 'custom':
        // Custom will show date inputs
        break
    }

    onFilterChange({
      preset: preset as any,
      dateRange: { from, to }
    })
  }

  const hasActiveFilters =
    filters.teams.length > 0 ||
    filters.plans.length > 0 ||
    filters.status.length > 0 ||
    filters.dateRange.from ||
    filters.dateRange.to ||
    filters.search

  return (
    <div className="cs-card p-4">
      {/* Quick Filters */}
      <div className="space-y-4">
        {/* Search */}
        <div>
          <label className="cs-field__label">
            Cerca atleta
          </label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onFilterChange({ search: e.target.value })}
            placeholder="Nome, cognome, email..."
            className="cs-input"
          />
        </div>

        {/* Status Chips */}
        <div>
          <label className="cs-field__label">
            Stato
          </label>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map(status => (
              <button
                key={status.value}
                onClick={() => handleStatusChange(status.value)}
                className={`cs-btn cs-btn--sm ${filters.status.includes(status.value) ? 'cs-btn--primary' : 'cs-btn--ghost'}`}
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Presets */}
        <div>
          <label className="cs-field__label">
            Scadenza
          </label>
          <div className="flex flex-wrap gap-2">
            {presetOptions.map(preset => (
              <button
                key={preset.value}
                onClick={() => handlePresetChange(preset.value)}
                className={`cs-btn cs-btn--sm ${filters.preset === preset.value ? 'cs-btn--primary' : 'cs-btn--ghost'}`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Range */}
        {(filters.preset === 'custom' || (filters.dateRange.from && filters.dateRange.to)) && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="cs-field__label">
                Da
              </label>
              <input
                type="date"
                value={filters.dateRange.from}
                onChange={(e) => onFilterChange({
                  dateRange: { ...filters.dateRange, from: e.target.value }
                })}
                className="cs-input"
              />
            </div>
            <div>
              <label className="cs-field__label">
                A
              </label>
              <input
                type="date"
                value={filters.dateRange.to}
                onChange={(e) => onFilterChange({
                  dateRange: { ...filters.dateRange, to: e.target.value }
                })}
                className="cs-input"
              />
            </div>
          </div>
        )}

        {/* Advanced Filters Toggle */}
        <button onClick={() => setShowAdvanced(!showAdvanced)} className="cs-btn cs-btn--ghost cs-btn--sm flex items-center gap-1">
          {showAdvanced ? '▼' : '▶'} Filtri Avanzati
        </button>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="space-y-4 border-t pt-4">
            {/* Teams Multi-select */}
            <div>
              <label className="cs-field__label">
                Squadre
              </label>
              <div className="max-h-32 overflow-y-auto cs-card">
                {teams.map(team => (
                  <label key={team.id} className="flex items-center p-2">
                    <input
                      type="checkbox"
                      checked={filters.teams.includes(team.id)}
                      onChange={() => handleTeamChange(team.id)}
                      className="mr-2"
                    />
                    <span className="text-sm">{team.name} ({team.code})</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Plans Multi-select */}
            <div>
              <label className="cs-field__label">
                Piani di Pagamento
              </label>
              <div className="max-h-32 overflow-y-auto cs-card">
                {plans.map(plan => (
                  <label key={plan.id} className="flex items-center p-2">
                    <input
                      type="checkbox"
                      checked={filters.plans.includes(plan.id)}
                      onChange={() => handlePlanChange(plan.id)}
                      className="mr-2"
                    />
                    <span className="text-sm">{plan.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Filter Actions */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-secondary">
            {hasActiveFilters ? 'Filtri attivi' : 'Nessun filtro attivo'}
          </span>

          {hasActiveFilters && (
            <button onClick={onClearFilters} className="cs-btn cs-btn--danger cs-btn--sm">
              Cancella filtri
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
