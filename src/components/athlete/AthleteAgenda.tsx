'use client'

import type { AthleteCalendarEvent } from '@/types/athlete-calendar'
import AttendanceControl from './AttendanceControl'
import type { AttendanceStatus } from '@/types/attendance'

type AgendaEvent = Pick<
  AthleteCalendarEvent,
  'id' | 'title' | 'description' | 'location' | 'start_time' | 'end_time' | 'teams' | 'event_kind'
  | 'requires_confirmation' | 'confirmation_deadline' | 'my_attendance' | 'has_conflict'
>

export type AgendaDay = {
  key: string
  date: Date
  events: AgendaEvent[]
}

const eventKindLabels: Record<string, string> = {
  training: 'Allenamento',
  match: 'Partita',
  meeting: 'Riunione',
  other: 'Altro',
}

function dateKey(date: Date): string {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, index) => index === 0 ? String(part) : String(part).padStart(2, '0'))
    .join('-')
}

export function groupEventsByDay(events: AgendaEvent[]): AgendaDay[] {
  const groups = new Map<string, AgendaDay>()

  for (const event of events) {
    const date = new Date(event.start_time)
    if (Number.isNaN(date.getTime())) continue
    const key = dateKey(date)
    const existing = groups.get(key)
    if (existing) {
      existing.events.push(event)
    } else {
      groups.set(key, { key, date, events: [event] })
    }
  }

  return [...groups.values()]
    .map((day) => ({
      ...day,
      events: [...day.events].sort(
        (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
      ),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
}

function formatTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Orario non disponibile'
    : date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

function formatDay(date: Date): string {
  return date.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function kindLabel(kind: string | null | undefined): string | null {
  return kind ? eventKindLabels[kind] ?? kind : null
}

export default function AthleteAgenda({
  events,
  canRespond,
  onAttendanceChange,
  onEventClick,
}: {
  events: AgendaEvent[]
  canRespond: boolean
  onAttendanceChange: (eventId: string, status: AttendanceStatus) => Promise<void>
  onEventClick: (id: string) => void
}) {
  const days = groupEventsByDay(events)
  const firstEventId = days[0]?.events[0]?.id ?? null

  return (
    <div className="space-y-5" aria-label="Agenda eventi">
      {days.map((day) => (
        <section key={day.key} aria-labelledby={`agenda-day-${day.key}`}>
          <h3
            id={`agenda-day-${day.key}`}
            className="mb-2 text-sm font-semibold capitalize text-[color:var(--cs-text-secondary)]"
          >
            {formatDay(day.date)}
          </h3>
          <div className="overflow-hidden rounded-[var(--cs-radius-md)] border border-[color:var(--cs-border-subtle)] bg-[color:var(--cs-surface-1)]">
            {day.events.map((event, index) => (
              <AgendaRow
                key={event.id}
                event={event}
                defaultExpanded={event.id === firstEventId && index === 0}
                canRespond={canRespond}
                onAttendanceChange={onAttendanceChange}
                onEventClick={onEventClick}
              />
            ))}
          </div>
        </section>
      ))}
      {days.length === 0 && (
        <p className="px-1 py-4 text-sm text-[color:var(--cs-text-secondary)]">
          Nessun evento trovato.
        </p>
      )}
    </div>
  )
}

function AgendaRow({
  event,
  defaultExpanded,
  canRespond,
  onAttendanceChange,
  onEventClick,
}: {
  event: AgendaEvent
  defaultExpanded: boolean
  canRespond: boolean
  onAttendanceChange: (eventId: string, status: AttendanceStatus) => Promise<void>
  onEventClick: (id: string) => void
}) {
  return (
    <details className="group border-b border-[color:var(--cs-border-subtle)] last:border-b-0" open={defaultExpanded}>
      <summary className="flex min-w-0 cursor-pointer list-none items-start gap-3 px-3 py-3 [&::-webkit-details-marker]:hidden">
        <span className="w-20 shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-[color:var(--cs-text-primary)]">
          {formatTime(event.start_time)}
          <span className="block text-xs font-normal text-[color:var(--cs-text-tertiary)]">
            {formatTime(event.end_time)}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-[color:var(--cs-text-primary)]">
            {event.title}
          </span>
          <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[color:var(--cs-text-secondary)]">
            {kindLabel(event.event_kind) && <span>{kindLabel(event.event_kind)}</span>}
            {event.location && <span className="truncate">{event.location}</span>}
            {event.teams.length > 0 && <span className="truncate">{event.teams.join(', ')}</span>}
            {event.has_conflict && <span role="status" className="font-semibold text-[color:var(--cs-danger-canonical)]">⚠ Conflitto di orario</span>}
          </span>
        </span>
        <span aria-hidden="true" className="pt-1 text-xs text-[color:var(--cs-text-tertiary)] transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="border-t border-[color:var(--cs-border-subtle)] px-3 pb-3 pt-2">
        {event.description && <p className="mb-2 text-sm text-[color:var(--cs-text-secondary)]">{event.description}</p>}
        {defaultExpanded && (
          <AttendanceControl
            requiresConfirmation={event.requires_confirmation}
            confirmationDeadline={event.confirmation_deadline}
            initialStatus={event.my_attendance?.status ?? null}
            canRespond={canRespond}
            onChange={(status) => onAttendanceChange(event.id, status)}
          />
        )}
        <button
          type="button"
          className="cs-btn cs-btn--ghost cs-btn--sm"
          onClick={() => onEventClick(event.id)}
        >
          Apri dettagli
        </button>
      </div>
    </details>
  )
}
