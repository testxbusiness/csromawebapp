'use client'

import { useEffect, useState } from 'react'
import type { AttendanceAvailabilityContract, AttendanceMode, AttendanceStatus } from '@/types/attendance'
import { FeedbackState } from '@/components/ui/FeedbackState'

type EventContext = {
  teams: string[]
  start?: string
  end?: string
}

type AttendanceControlProps = {
  requiresConfirmation: boolean
  eventKind?: 'training' | 'match' | 'meeting' | 'other' | string
  attendanceMode?: AttendanceMode
  confirmationDeadline?: string | null
  initialStatus?: AttendanceStatus | null
  canRespond: boolean
  onChange: (status: AttendanceStatus) => Promise<void>
  availability?: AttendanceAvailabilityContract | null
  eventContext?: EventContext
  initialEarlyAbsence?: boolean
  onEarlyAbsence?: (note: string) => Promise<void>
  onRevokeEarlyAbsence?: () => Promise<void>
}

type EarlyAbsenceSectionProps = {
  availability: AttendanceAvailabilityContract | null
  eventContext?: EventContext
  earlyAbsence: boolean
  showForm: boolean
  note: string
  pending: boolean
  error: string | null
  isOnline: boolean
  onOpen: () => void
  onCancel: () => void
  onNoteChange: (value: string) => void
  onReport: () => Promise<void>
  onRevoke: () => Promise<void>
  absenceOnly?: boolean
}

const SUCCESS_FEEDBACK_DURATION_MS = 4000

export function isDeadlinePassed(deadline?: string | null, now = new Date()) {
  return Boolean(deadline && new Date(deadline).getTime() <= now.getTime())
}

function formatDeadline(deadline: string) {
  return new Date(deadline).toLocaleString('it-IT', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatEventDate(value?: string) {
  return value
    ? new Date(value).toLocaleString('it-IT', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—'
}

function getStatusLabel(status: AttendanceStatus | null) {
  if (status === 'going') return 'Partecipo'
  if (status === 'maybe') return 'Forse'
  if (status === 'declined') return 'Non partecipo'
  return 'Nessuna risposta'
}

export default function AttendanceControl({
  requiresConfirmation,
  eventKind,
  attendanceMode,
  confirmationDeadline,
  initialStatus = null,
  canRespond,
  onChange,
  availability = null,
  eventContext,
  initialEarlyAbsence = false,
  onEarlyAbsence,
  onRevokeEarlyAbsence,
}: AttendanceControlProps) {
  const [status, setStatus] = useState<AttendanceStatus | null>(initialStatus)
  const [pendingStatus, setPendingStatus] = useState<AttendanceStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [earlyAbsence, setEarlyAbsence] = useState(initialEarlyAbsence || (attendanceMode === 'absence_only' && initialStatus === 'declined'))
  const [showForm, setShowForm] = useState(false)
  const [note, setNote] = useState('')
  const [earlyPending, setEarlyPending] = useState(false)
  const [earlyError, setEarlyError] = useState<string | null>(null)
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
    setEarlyAbsence(initialEarlyAbsence || (attendanceMode === 'absence_only' && initialStatus === 'declined'))
    setError(null)
    setEarlyError(null)
    setShowForm(false)
  }, [initialStatus, initialEarlyAbsence, attendanceMode])

  useEffect(() => {
    if (!showSuccess) return
    const timeout = window.setTimeout(
      () => setShowSuccess(false),
      SUCCESS_FEEDBACK_DURATION_MS,
    )
    return () => window.clearTimeout(timeout)
  }, [showSuccess])

  if (!requiresConfirmation) return null

  // Athletes can only communicate an absence for trainings and matches. The
  // server-provided mode remains authoritative for other event kinds.
  const absenceOnly = eventKind === 'training' || eventKind === 'match'
    || availability?.attendance_mode === 'absence_only'
    || attendanceMode === 'absence_only'

  // A successful revocation restores the neutral state locally. The user can
  // then choose an RSVP voluntarily while the authoritative R4 refresh runs.
  const canRespondNow = availability
    ? availability.actions.respond ||
      (!earlyAbsence && availability.closure_reason === 'already_early_absence')
    : canRespond
  const statusLabel = getStatusLabel(status)
  const reason = availability?.closure_reason === 'not_next_event'
    ? 'La risposta è disponibile sul prossimo evento autorizzato.'
    : availability?.closure_reason === 'event_started'
      ? 'L’evento è iniziato: la risposta è in sola lettura.'
      : availability?.closure_reason === 'already_responded'
        ? 'La risposta è stata registrata.'
        : availability?.closure_reason === 'deadline_passed'
          ? 'La deadline è superata: la risposta è in sola lettura.'
          : !canRespond
            ? 'La risposta è gestita dal delegato autorizzato.'
            : 'La risposta non è disponibile per questo evento.'

  const earlyAbsenceProps: EarlyAbsenceSectionProps = {
    availability: !deadlinePassed && (onEarlyAbsence || onRevokeEarlyAbsence)
      ? availability
      : null,
    eventContext,
    earlyAbsence,
    showForm,
    note,
    pending: earlyPending,
    error: earlyError,
    isOnline,
    onOpen: () => {
      setEarlyError(null)
      setShowForm(true)
    },
    onCancel: () => setShowForm(false),
    onNoteChange: setNote,
    onReport: async () => {
      if (!onEarlyAbsence) return
      setEarlyPending(true)
      setEarlyError(null)
      try {
        await onEarlyAbsence(note.trim())
        setEarlyAbsence(true)
        setShowForm(false)
      } catch (cause) {
        setEarlyError(
          cause instanceof Error ? cause.message : 'Impossibile salvare l’assenza',
        )
      } finally {
        setEarlyPending(false)
      }
    },
    onRevoke: async () => {
      if (!onRevokeEarlyAbsence) return
      setEarlyPending(true)
      setEarlyError(null)
      try {
        await onRevokeEarlyAbsence()
        setEarlyAbsence(false)
        setStatus(null)
      } catch (cause) {
        setEarlyError(
          cause instanceof Error ? cause.message : 'Impossibile revocare l’assenza',
        )
      } finally {
        setEarlyPending(false)
      }
    },
    absenceOnly,
  }

  if (absenceOnly) {
    const absenceClosed = deadlinePassed || !isOnline || Boolean(
      availability &&
      !availability.actions.report_early_absence &&
      !availability.actions.revoke_early_absence,
    )
    return (
      <div className="mt-3 border-t border-[color:var(--cs-border)] pt-3" aria-label="Segnalazione assenza">
        {earlyAbsence ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" role="status">
            <span>{absenceOnly ? 'Assenza segnalata' : <>Hai segnalato: <span className="font-medium text-[color:var(--cs-text)]">Assenza</span></>}</span>
            {absenceClosed && <span className="text-secondary">· {isOnline ? 'Segnalazioni chiuse' : 'Non disponibile offline'}</span>}
          </div>
        ) : absenceClosed ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" role="status">
            <span className="font-medium text-[color:var(--cs-text)]">Segnalazione assenza</span>
            <span className="text-secondary">· {isOnline ? 'Segnalazioni chiuse' : 'Non disponibile offline'}</span>
          </div>
        ) : (
          <p className="text-sm text-secondary">
            {canRespond
              ? 'Non puoi esserci? Segnala l’assenza qui: il coach la vedrà nell’app.'
              : 'La segnalazione dell’assenza non è disponibile per questo profilo.'}
          </p>
        )}
        <EarlyAbsenceSection {...earlyAbsenceProps} />
      </div>
    )
  }

  if (!canRespondNow || deadlinePassed || !isOnline) {
    const statusReason = !isOnline
      ? 'Sei offline: la risposta non è disponibile.'
      : deadlinePassed
        ? 'Deadline superata: non è più possibile rispondere.'
        : reason
    return (
      <>
        <div className="mt-3 border-t border-[color:var(--cs-border)] pt-3 text-sm" role="status" aria-label="Stato risposta">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-[color:var(--cs-text)]">
              {status ? <>Hai risposto: {statusLabel}</> : <>Risposta: {statusLabel}</>}
            </span>
            <span className="text-secondary">· {isOnline ? 'Risposte chiuse' : 'Risposta non disponibile offline'}</span>
          </div>
          <span className="mt-1 block text-xs text-secondary">{statusReason}</span>
        </div>
        <EarlyAbsenceSection {...earlyAbsenceProps} />
      </>
    )
  }

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
      setError(
        cause instanceof Error ? cause.message : 'Impossibile salvare la risposta',
      )
    } finally {
      setPendingStatus(null)
    }
  }

  return (
    <div
      className="mt-3 border-t border-[color:var(--cs-border)] pt-3"
      aria-label="Conferma partecipazione"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-secondary">
          Risposta:{' '}
          <span className="font-medium text-[color:var(--cs-text)]">{statusLabel}</span>
        </p>
        {confirmationDeadline && (
          <p className="text-xs text-secondary">
            Rispondi entro {formatDeadline(confirmationDeadline)}
          </p>
        )}
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
            className={'cs-btn min-h-11 ' + (
              status === nextStatus ? 'cs-btn--primary' : 'cs-btn--ghost'
            )}
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
      <EarlyAbsenceSection {...earlyAbsenceProps} />
    </div>
  )
}

function EarlyAbsenceSection({
  availability,
  eventContext,
  earlyAbsence,
  showForm,
  note,
  pending,
  error,
  isOnline,
  onOpen,
  onCancel,
  onNoteChange,
  onReport,
  onRevoke,
  absenceOnly = false,
}: EarlyAbsenceSectionProps) {
  if (
    !availability ||
    !eventContext ||
    (!availability.actions.report_early_absence &&
      !availability.actions.revoke_early_absence)
  ) {
    return null
  }

  return (
    <div
      className="mt-3 border-t border-[color:var(--cs-border)] pt-3"
      aria-label="Assenza anticipata"
    >
      {earlyAbsence ? (
        <>
          <p className="text-sm font-medium" role="status">{absenceOnly ? 'Assenza segnalata' : 'Hai già comunicato che non parteciperai'}</p>
          <p className="mt-1 text-xs text-secondary">
            Puoi modificare volontariamente la comunicazione entro la scadenza.
          </p>
          {availability.actions.revoke_early_absence && (
            <button
              type="button"
              className="cs-btn cs-btn--outline cs-btn--sm mt-2"
              onClick={() => void onRevoke()}
              disabled={pending || !isOnline}
            >
              {pending ? (absenceOnly ? 'Annullamento…' : 'Revoca…') : (absenceOnly ? 'Annulla segnalazione' : 'Revoca assenza')}
            </button>
          )}
        </>
      ) : showForm ? (
        <div className="space-y-3 rounded-[var(--cs-radius-md)] bg-[color:var(--cs-surface-2)] p-3">
          <p className="text-sm font-semibold">Conferma assenza</p>
          <p className="text-sm text-secondary">
            {eventContext.teams.length
              ? eventContext.teams.join(', ')
              : 'Squadra non disponibile'}{' '}
            · {formatEventDate(eventContext.start)} – {formatEventDate(eventContext.end)}
          </p>
          <label className="block text-sm font-medium" htmlFor="early-absence-note">
            Nota (facoltativa)
          </label>
          <textarea
            id="early-absence-note"
            value={note}
            maxLength={1000}
            onChange={(event) => onNoteChange(event.target.value)}
            className="cs-input min-h-20 w-full"
            placeholder="Aggiungi una nota per lo staff"
          />
          {error && (
            <p className="text-sm text-[color:var(--cs-danger)]" role="alert">
              {error}
            </p>
          )}
          {!isOnline && (
            <p className="text-sm text-secondary" role="status">
              Sei offline: l’assenza non può essere salvata.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="cs-btn cs-btn--primary cs-btn--sm"
              onClick={() => void onReport()}
              disabled={pending || !isOnline}
            >
              {pending ? 'Salvataggio…' : 'Conferma assenza'}
            </button>
            <button
              type="button"
              className="cs-btn cs-btn--ghost cs-btn--sm"
              onClick={onCancel}
              disabled={pending}
            >
              Annulla
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="cs-btn cs-btn--outline cs-btn--sm"
          onClick={() => { if (absenceOnly) void onReport(); else onOpen() }}
          disabled={!availability.actions.report_early_absence || !isOnline}
        >
          {pending ? 'Salvataggio…' : 'Segnala assenza'}
        </button>
      )}
      {error && !showForm && (
        <p className="mt-2 text-sm text-[color:var(--cs-danger)]" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
