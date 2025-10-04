'use client'

import { useState } from 'react'

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

interface PaginationState {
  page: number
  limit: number
  total: number
}

interface InstallmentsTableProps {
  installments: Installment[]
  loading: boolean
  selectedInstallments: Set<string>
  onInstallmentSelect: (installmentId: string) => void
  onSelectAll: () => void
  onAthleteClick: (athleteId: string) => void
  pagination: PaginationState
  onPageChange: (page: number) => void
}

export default function InstallmentsTable({
  installments,
  loading,
  selectedInstallments,
  onInstallmentSelect,
  onSelectAll,
  onAthleteClick,
  pagination,
  onPageChange
}: InstallmentsTableProps) {
  const [groupBy, setGroupBy] = useState<'none' | 'athlete' | 'plan'>('none')

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

  const getRemainingAmount = (installment: Installment) => {
    if (installment.status === 'paid') return 0
    return installment.amount
  }

  const totalPages = Math.ceil(pagination.total / pagination.limit)

  if (loading) {
    return (
      <div className="cs-card overflow-hidden">
        <div className="p-4 border-b">
          <div className="cs-skeleton" style={{ height: 24, width: 128 }} />
        </div>
        <div className="p-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center p-4 border-b">
              <div className="cs-skeleton" style={{ height: 16, width: 16, marginRight: 16 }} />
              <div className="flex-1">
                <div className="cs-skeleton" style={{ height: 16, width: '25%', marginBottom: 6 }} />
                <div className="cs-skeleton" style={{ height: 12, width: '16%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="cs-card overflow-hidden">
      {/* Table Header */}
      <div className="p-4 border-b flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={selectedInstallments.size === installments.length && installments.length > 0}
              onChange={onSelectAll}
              className="h-4 w-4"
            />
            <span className="ml-2 text-sm text-secondary">
              Selezionate {selectedInstallments.size} di {installments.length} rate
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm text-secondary">Raggruppa per:</span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
              className="cs-select text-sm"
            >
              <option value="none">Nessun raggruppamento</option>
              <option value="athlete">Atleta</option>
              <option value="plan">Piano di Pagamento</option>
            </select>
          </div>
        </div>

        <div className="text-sm text-secondary">
          Totale: {pagination.total.toLocaleString('it-IT')} rate
        </div>
      </div>

      {/* Table */}
      <div className="cs-card p-4">
        <table className="cs-table">
          <thead>
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">
                <input
                  type="checkbox"
                  checked={selectedInstallments.size === installments.length && installments.length > 0}
                  onChange={onSelectAll}
                  className="h-4 w-4"
                />
              </th>
              <th>
                Atleta
              </th>
              <th>
                Squadra
              </th>
              <th>
                Piano
              </th>
              <th>
                Rata
              </th>
              <th>
                Importo
              </th>
              <th>
                Scadenza
              </th>
              <th>
                Stato
              </th>
              <th>
                Residuo
              </th>
              <th>
                Note
              </th>
            </tr>
          </thead>
          <tbody>
            {installments.map((installment) => (
              <tr key={installment.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedInstallments.has(installment.id)}
                    onChange={() => onInstallmentSelect(installment.id)}
                    className="h-4 w-4"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => onAthleteClick(installment.profile_id)}
                    className="cs-btn cs-btn--ghost cs-btn--sm text-left"
                  >
                    <div className="font-medium">
                      {installment.profile?.first_name} {installment.profile?.last_name}
                    </div>
                    <div className="text-sm text-secondary">{installment.profile?.email}</div>
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {installment.team?.name} ({installment.team?.code})
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {installment.membership_fee?.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  Rata {installment.installment_number}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  €{installment.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {formatDate(installment.due_date)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`cs-badge ${
                    installment.status==='paid' ? 'cs-badge--success' :
                    installment.status==='overdue' ? 'cs-badge--danger' :
                    installment.status==='due_soon' ? 'cs-badge--warning' :
                    'cs-badge--neutral'
                  }`}>
                    {getStatusLabel(installment.status)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  €{getRemainingAmount(installment).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary">
                  {installment.notes || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t flex items-center justify-between">
          <div className="text-sm text-secondary">
            Pagina {pagination.page} di {totalPages}
          </div>
          <div className="flex space-x-2">
            <button onClick={() => onPageChange(pagination.page - 1)} disabled={pagination.page <= 1} className="cs-btn cs-btn--ghost cs-btn--sm disabled:opacity-50 disabled:cursor-not-allowed">
              Precedente
            </button>
            <button onClick={() => onPageChange(pagination.page + 1)} disabled={pagination.page >= totalPages} className="cs-btn cs-btn--ghost cs-btn--sm disabled:opacity-50 disabled:cursor-not-allowed">
              Successiva
            </button>
          </div>
        </div>
      )}

      {installments.length === 0 && !loading && (
        <div className="p-8 text-center text-secondary">
          Nessuna rata trovata con i filtri selezionati
        </div>
      )}
    </div>
  )
}
