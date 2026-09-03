'use client'

import { useEffect, useState } from 'react'
import type { AttendanceStatus } from '@/types/attendance'
import { FeedbackState } from '@/components/ui/FeedbackState'

type AttendanceControlProps = {
  requiresConfirmation: boolean
  confirmationDeadline?: string | null
  initialStatus?: AttendanceStatus | null
  canRespond: boolean
  onChange: (status: AttendanceStatus) => Promise<void>
}

const SUCCESS_FEEDBACK_DURATION_MS = 4000

function isDeadlinePassed(deadline?: string | null, now = new Date()) {
  return Boolean(deadline && new Date(deadline).getTime() <= now.getTime())
}

function formatDeadline(deadline: string) {
  return new Date(deadline).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function AttendanceControl({
  requiresConfirmation,
  confirmationDeadline,
  initialStatus = null,
  canRespond,
  onChange,
}: AttendanceControlProps) {
  const [status, setStatus] = useState<AttendanceStatus | null>(initialStatus)
  const [pendingStatus, setPendingStatus] = useState<AttendanceStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const deadlinePassed = isDeadlinePassed(confirmationDeadline)

  useEffect(() => {
    const updateConnectivity = () => setIsOnline(navigator.onLine)
    updateConnectivity()
    window.addEventListener('online', updateConnectivity)
    window.addEventListener('offline', updateConnectivity)
    return () => {
      window.removeEventListener('online', updateConnectivity)
      window.removeEventListener('offline', updateConnectivity)
    }
  }, [])

  useEffect(() => {
    setStatus(initialStatus)
    setError(null)
  }, [initialStatus])

  useEffect(() => {
    if (!showSuccess) return
    const timeout = window.setTimeout(() => setShowSuccess(false), SUCCESS_FEEDBACK_DURATION_MS)
    return () => window.clearTimeout(timeout)
  }, [showSuccess])

  if (!requiresConfirmation) return null

  const statusLabel = status === 'going'
    ? 'Partecipo'
    : status === 'maybe'
      ? 'Forse'
      : status === 'declined'
        ? 'Non partecipo'
        : 'Nessuna risposta'

  const handleChange = async (nextStatus: AttendanceStatus) => {
    if (!canRespond || !isOnline || deadlinePassed || pendingStatus) return
    const previousStatus = status
    setStatus(nextStatus)
    setPendingStatus(nextStatus)
    setError(null)
    setShowSuccess(false)
    try {
      await onChange(nextStatus)
      setShowSuccess(true)
    } catch (cause) {
      setStatus(previousStatus)
      setError(cause instanceof Error ? cause.message : 'Impossibile salvare la risposta')
    } finally {
      setPendingStatus(null)
    }
  }

  if (!canRespond) {
    return (
      <div className="mt-3 border-t border-[color:var(--cs-border)] pt-3 text-sm text-secondary" role="status">
        <span className="font-medium text-[color:var(--cs-text)]">Risposta: {statusLabel}</span>
        <span className="ml-2">La risposta è gestita dal delegato autorizzato.</span>
      </div>
    )
  }

  if (deadlinePassed) {
    return (
      <div className="mt-3 border-t border-[color:var(--cs-border)] pt-3 text-sm" role="status">
        <span className="font-medium text-[color:var(--cs-text)]">Risposta: {statusLabel}</span>
        <span className="ml-2 text-secondary">Deadline superata: non è più possibile rispondere.</span>
      </div>
    )
  }

  if (!isOnline) {
    return (
      <div className="mt-3 border-t border-[color:var(--cs-border)] pt-3 text-sm" role="status">
        <span className="font-medium text-[color:var(--cs-text)]">Risposta: {statusLabel}</span>
        <span className="ml-2 text-secondary">Sei offline: la risposta non è disponibile.</span>
      </div>
    )
  }

  return (
    <div className="mt-3 border-t border-[color:var(--cs-border)] pt-3" aria-label="Conferma partecipazione">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-secondary">
          Risposta: <span className="font-medium text-[color:var(--cs-text)]">{statusLabel}</span>
        </p>
        {confirmationDeadline && <p className="text-xs text-secondary">Rispondi entro {formatDeadline(confirmationDeadline)}</p>}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {([
          ['going', 'Partecipo'],
          ['maybe', 'Forse'],
          ['declined', 'Non partecipo'],
        ] as const).map(([nextStatus, label]) => (
          <button
            key={nextStatus}
            type="button"
            className={`cs-btn min-h-11 ${status === nextStatus ? 'cs-btn--primary' : 'cs-btn--ghost'}`}
            onClick={() => void handleChange(nextStatus)}
            disabled={Boolean(pendingStatus)}
            aria-pressed={status === nextStatus}
          >
            {pendingStatus === nextStatus ? 'Salvataggio…' : label}
          </button>
        ))}
      </div>
      {error && (
        <p className="mt-2 text-sm text-[color:var(--cs-danger)]" role="alert">
          {error} La risposta precedente è stata ripristinata.
        </p>
      )}
      {showSuccess && !error && (
        <FeedbackState
          variant="success"
          title="Risposta salvata"
          description="La tua conferma è stata aggiornata."
          className="mt-2 px-3 py-2"
        />
      )}
    </div>
  )
}

export { isDeadlinePassed }
