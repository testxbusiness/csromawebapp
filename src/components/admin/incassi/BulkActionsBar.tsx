'use client'

interface BulkActionsBarProps {
  selectedCount: number
  totalCount: number
  onBulkPayment: () => void
  onSelectAll: () => void
}

export default function BulkActionsBar({
  selectedCount,
  totalCount,
  onBulkPayment,
  onSelectAll
}: BulkActionsBarProps) {
  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 cs-card p-4 z-50">
      <div className="flex items-center justify-between space-x-4">
        <div className="flex items-center space-x-4">
          <div className="text-sm">
            <span className="font-medium">Selezionate {selectedCount.toLocaleString('it-IT')} rate</span>
            <span className="text-secondary ml-2">
              di {totalCount.toLocaleString('it-IT')} filtrate
            </span>
          </div>

          {selectedCount < totalCount && (
            <button onClick={onSelectAll} className="cs-btn cs-btn--ghost cs-btn--sm">
              Seleziona tutte {totalCount.toLocaleString('it-IT')}
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button onClick={onBulkPayment} className="cs-btn cs-btn--primary cs-btn--sm">
            Segna come pagate ({selectedCount})
          </button>

          <button className="cs-btn cs-btn--ghost cs-btn--sm">
            Esporta CSV
          </button>
        </div>
      </div>
    </div>
  )
}
