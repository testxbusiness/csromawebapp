'use client'

interface KPICardsProps {
  data: {
    not_due: number
    due_soon: number
    overdue: number
    partially_paid: number
    paid: number
    total_amount: number
    total_paid: number
  }
  onCardClick: (status: string) => void
  loading: boolean
}

export default function KPICards({ data, onCardClick, loading }: KPICardsProps) {
  const cards = [
    {
      key: 'not_due',
      title: 'Non Scadute',
      count: data.not_due,
      color: 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100',
      icon: '🟦'
    },
    {
      key: 'due_soon',
      title: 'In Scadenza',
      count: data.due_soon,
      color: 'bg-yellow-50 border-yellow-200 text-yellow-800 hover:bg-yellow-100',
      icon: '🟨'
    },
    {
      key: 'overdue',
      title: 'Scadute',
      count: data.overdue,
      color: 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100',
      icon: '🟥'
    },
    {
      key: 'partially_paid',
      title: 'Parz. Pagate',
      count: data.partially_paid,
      color: 'bg-purple-50 border-purple-200 text-purple-800 hover:bg-purple-100',
      icon: '🟪'
    },
    {
      key: 'paid',
      title: 'Pagate',
      count: data.paid,
      color: 'bg-green-50 border-green-200 text-green-800 hover:bg-green-100',
      icon: '🟩'
    }
  ]

  const totalInstallments = cards.reduce((sum, card) => sum + card.count, 0)
  const collectionRate = data.total_amount > 0 ? (data.total_paid / data.total_amount) * 100 : 0

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="cs-card animate-pulse">
            <div className="cs-skeleton" style={{ height: 16, marginBottom: 8 }} />
            <div className="cs-skeleton" style={{ height: 24 }} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {cards.map(card => (
          <button
            key={card.key}
            onClick={() => onCardClick(card.key)}
            className={`cs-card text-left cursor-pointer ${card.color}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg">{card.icon}</span>
              <span className="text-xs font-medium opacity-75">{card.title}</span>
            </div>
            <div className="text-2xl font-bold">{card.count.toLocaleString('it-IT')}</div>
          </button>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="cs-card">
          <div className="text-sm text-secondary mb-1">Totale Rate</div>
          <div className="text-xl font-semibold">{totalInstallments.toLocaleString('it-IT')}</div>
        </div>
        <div className="cs-card">
          <div className="text-sm text-secondary mb-1">Importo Totale</div>
          <div className="text-xl font-semibold">€{data.total_amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="cs-card">
          <div className="text-sm text-secondary mb-1">Tasso Incasso</div>
          <div className="text-xl font-semibold">{collectionRate.toFixed(1)}%</div>
        </div>
      </div>

      {/* All Installments Button */}
      <div className="flex justify-center">
        <button onClick={() => onCardClick('all')} className="cs-btn cs-btn--ghost">
          Mostra tutte le rate
        </button>
      </div>
    </div>
  )
}
