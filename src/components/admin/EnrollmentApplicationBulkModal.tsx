'use client'

import AdminModal from './AdminModal'

interface EnrollmentApplicationBulkModalProps {
  delivered: boolean | null
  isOpen: boolean
  isSubmitting: boolean
  onClose: () => void
  onConfirm: () => void
  selectedCount: number
  seasonName: string
}

export default function EnrollmentApplicationBulkModal({
  delivered,
  isOpen,
  isSubmitting,
  onClose,
  onConfirm,
  selectedCount,
  seasonName,
}: EnrollmentApplicationBulkModalProps) {
  const stateLabel = delivered ? 'consegnata' : 'non consegnata'

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title="Conferma aggiornamento domanda"
      sizeClassName="max-w-md"
      footer={(
        <>
          <button type="button" className="cs-btn cs-btn--ghost" onClick={onClose} disabled={isSubmitting}>Annulla</button>
          <button type="button" className="cs-btn cs-btn--primary" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Aggiornamento...' : `Segna ${stateLabel}`}
          </button>
        </>
      )}
    >
      <p>
        Stai per segnare la domanda come <strong>{stateLabel}</strong> per <strong>{selectedCount}</strong> atlet{selectedCount === 1 ? 'a' : 'i'} nella stagione <strong>{seasonName}</strong>.
      </p>
    </AdminModal>
  )
}
