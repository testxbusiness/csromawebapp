'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Modal from '@/components/ui/Modal'
import { appendSubjectProfile } from '@/context/AccessibleProfileContext'
import type { AthleteCalendarEvent } from '@/types/athlete-calendar'

const PAGE_SIZE = 20

type PeriodPage = {
  events?: AthleteCalendarEvent[]
  has_more?: boolean
  next_offset?: number | null
}

type EarlyAbsencePeriodModalProps = {
  open: boolean
  subjectProfileId: string | null
  onClose: () => void
  onSaved: () => void
}

function eventTeamLabels(event: AthleteCalendarEvent) {
  if (Array.isArray(event.teams) && event.teams.length > 0) return event.teams
  if (Array.isArray(event.team_details) && event.team_details.length > 0) {
    return event.team_details.map((team) => team.name)
  }
  return Array.isArray(event.team_ids) ? event.team_ids : []
}

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(value))
}

function formatEventTime(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' })
  return `${formatter.format(new Date(start))}–${formatter.format(new Date(end))}`
}

function todayLocal() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export default function EarlyAbsencePeriodModal({ open, subjectProfileId, onClose, onSaved }: EarlyAbsencePeriodModalProps) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [events, setEvents] = useState<AthleteCalendarEvent[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [note, setNote] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error' | 'offline'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [nextOffset, setNextOffset] = useState<number | null>(0)
  const [submitting, setSubmitting] = useState(false)

  const reset = useCallback(() => {
    setFrom('')
    setTo('')
    setEvents([])
    setSelectedIds(new Set())
    setNote('')
    setState('idle')
    setError(null)
    setHasMore(false)
    setNextOffset(0)
    setSubmitting(false)
  }, [])

  useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  useEffect(() => {
    reset()
  }, [subjectProfileId, reset])

  const periodValid = Boolean(from && to && from <= to)

  const loadPage = useCallback(async (offset: number, replace: boolean) => {
    if (!periodValid) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setState('offline')
      setError(null)
      return
    }
    setState('loading')
    setError(null)
    try {
      const params = new URLSearchParams({ from, to, offset: String(offset), limit: String(PAGE_SIZE) })
      const response = await fetch(appendSubjectProfile(`/api/athlete/events/early-absence?${params.toString()}`, subjectProfileId))
      const result = await response.json().catch(() => null) as (PeriodPage & { error?: string }) | null
      if (!response.ok) throw new Error(result?.error || 'Impossibile caricare gli eventi del periodo')
      const pageEvents = result?.events ?? []
      setEvents((current) => replace ? pageEvents : [...current, ...pageEvents.filter((event) => !current.some((item) => item.id === event.id))])
      setHasMore(result?.has_more === true)
      setNextOffset(typeof result?.next_offset === 'number' ? result.next_offset : null)
      setState('ready')
    } catch (cause: unknown) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      setState(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error')
      setError(cause instanceof Error ? cause.message : 'Impossibile caricare gli eventi del periodo')
    }
  }, [from, periodValid, subjectProfileId, to])

  const search = () => {
    setEvents([])
    setSelectedIds(new Set())
    if (!periodValid) {
      setState('idle')
      setError(null)
      return
    }
    void loadPage(0, true)
  }

  const toggleEvent = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allLoadedSelected = events.length > 0 && events.every((event) => selectedIds.has(event.id))
  const selectedEvents = useMemo(() => events.filter((event) => selectedIds.has(event.id)), [events, selectedIds])

  const toggleAllLoaded = () => {
    setSelectedIds((current) => {
      if (allLoadedSelected) return new Set([...current].filter((id) => !events.some((event) => event.id === id)))
      return new Set([...current, ...events.map((event) => event.id)])
    })
  }

  const submit = async () => {
    if (selectedEvents.length === 0 || submitting) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setState('offline')
      setError('Sei offline: l’assenza non può essere salvata')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch(appendSubjectProfile('/api/athlete/events/early-absence', subjectProfileId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_ids: selectedEvents.map((event) => event.id), note: note.trim() || undefined }),
      })
      const result = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) {
        const staleError = result?.error || 'Uno o più eventi non sono più disponibili. Aggiorna il riepilogo.'
        setSelectedIds(new Set())
        await loadPage(0, true)
        setState('error')
        setError(staleError)
        return
      }
      onSaved()
      onClose()
    } catch (cause: unknown) {
      setError(typeof navigator !== 'undefined' && !navigator.onLine ? 'Sei offline: l’assenza non può essere salvata' : cause instanceof Error ? cause.message : 'Impossibile salvare l’assenza')
      setState(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const periodError = from && to && from > to

  return (
    <Modal open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !submitting) onClose() }} title="Comunica assenza" description="Seleziona un periodo. Verranno mostrati gli eventi eleggibili di tutte le tue squadre." size="xl" fullscreenOnMobile>
      <div className="space-y-5">
        <div className="rounded-lg border border-[color:var(--cs-border)] bg-[color:var(--cs-surface-2)] p-3 text-sm">
          <strong>Ambito: tutte le squadre autorizzate</strong>
          <p className="mt-1 text-secondary">Il filtro squadra del calendario non limita questa ricerca.</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="cs-field"><span className="cs-field__label">Data iniziale</span><input className="cs-input min-h-11 w-full" type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label>
          <label className="cs-field"><span className="cs-field__label">Data finale</span><input className="cs-input min-h-11 w-full" type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label>
        </div>
        {periodError && <p role="alert" className="text-sm font-semibold text-[color:var(--cs-danger-canonical)]">Il periodo non è valido: la data finale deve essere uguale o successiva a quella iniziale.</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="cs-btn cs-btn--primary min-h-11" onClick={search} disabled={!periodValid || state === 'loading'}>Cerca eventi</button>
          <button type="button" className="cs-btn cs-btn--ghost min-h-11" onClick={() => { const date = todayLocal(); setFrom(date); setTo(date) }}>Oggi</button>
        </div>

        {state === 'loading' && <p role="status" aria-live="polite" className="text-sm text-secondary">Caricamento eventi del periodo…</p>}
        {state === 'offline' && <p role="alert" className="text-sm font-semibold text-[color:var(--cs-danger-canonical)]">Sei offline: collega il dispositivo per caricare o salvare le assenze.</p>}
        {state === 'error' && error && <p role="alert" className="text-sm font-semibold text-[color:var(--cs-danger-canonical)]">{error}</p>}
        {state === 'ready' && events.length === 0 && <p role="status" className="rounded-lg border border-dashed border-[color:var(--cs-border)] p-4 text-sm text-secondary">Nessun evento eleggibile nel periodo. Gli eventi già segnati come assenti non vengono riproposti.</p>}

        {events.length > 0 && <section aria-label="Eventi selezionabili" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">{events.length} eventi caricati · {selectedEvents.length} selezionati</p>
            <button type="button" className="cs-btn cs-btn--outline cs-btn--sm min-h-11" onClick={toggleAllLoaded}>{allLoadedSelected ? 'Deseleziona tutti' : 'Seleziona tutti gli eventi caricati'}</button>
          </div>
          <ul className="max-h-[min(42vh,24rem)] space-y-2 overflow-y-auto pr-1">
            {events.map((event) => <li key={event.id} className="rounded-lg border border-[color:var(--cs-border)] p-3">
              <label className="flex min-h-11 cursor-pointer items-start gap-3">
                <input type="checkbox" className="mt-1 size-5 shrink-0" checked={selectedIds.has(event.id)} onChange={() => toggleEvent(event.id)} aria-label={`Seleziona ${event.title}`} />
                <span className="min-w-0 text-sm"><strong className="block">{eventTeamLabels(event).join(', ') || 'Squadra non indicata'}</strong><span className="block capitalize">{formatEventDate(event.start_time)} · {formatEventTime(event.start_time, event.end_time)}</span><span className="block text-secondary">Stato: {event.my_attendance?.is_early_absence ? 'Assenza già comunicata' : 'Eleggibile'}</span></span>
              </label>
            </li>)}
          </ul>
          {hasMore && nextOffset !== null && <button type="button" className="cs-btn cs-btn--outline min-h-11 w-full" onClick={() => void loadPage(nextOffset, false)} disabled={state === 'loading'}>Carica altri eventi</button>}
        </section>}

        <label className="cs-field block"><span className="cs-field__label">Nota comune (facoltativa)</span><textarea className="cs-input min-h-24 w-full" maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Aggiungi una nota per tutti gli eventi selezionati" /><span className="text-xs text-secondary">{note.length}/1000</span></label>

        <div className="rounded-lg bg-[color:var(--cs-surface-2)] p-4" aria-live="polite"><strong>Riepilogo</strong><p className="mt-1 text-sm">Stai per comunicare l’assenza per <strong>{selectedEvents.length}</strong> {selectedEvents.length === 1 ? 'evento' : 'eventi'}{note.trim() ? ' con la nota comune inserita' : ''}.</p></div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" className="cs-btn cs-btn--ghost min-h-11" onClick={onClose} disabled={submitting}>Annulla</button><button type="button" className="cs-btn cs-btn--primary min-h-11" onClick={() => void submit()} disabled={selectedEvents.length === 0 || submitting}>{submitting ? 'Salvataggio…' : 'Conferma assenza'}</button></div>
      </div>
    </Modal>
  )
}
