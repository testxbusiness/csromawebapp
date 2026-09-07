'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { EVENT_KIND_OPTIONS, eventKindVisual, type EventKind } from '@/lib/events/event-kind'

export type MonthlyCalendarEvent = {
  id: string
  title: string
  start: Date | string
  end: Date | string
  eventKind?: string | null
  location?: string | null
}

type Day = {
  date: Date
  key: string
  events: MonthlyCalendarEvent[]
}

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
const PREVIEW_LIMIT = 2

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function startOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function isSameDay(left: Date, right: Date): boolean {
  return dateKey(left) === dateKey(right)
}

function formatTime(value: Date | string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

function formatDay(date: Date): string {
  return date.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function buildMonthDays(currentDate: Date, events: MonthlyCalendarEvent[]): Day[] {
  const firstOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const firstGridDay = new Date(firstOfMonth)
  const mondayIndex = (firstGridDay.getDay() + 6) % 7
  firstGridDay.setDate(firstGridDay.getDate() - mondayIndex)

  const eventsByDay = new Map<string, MonthlyCalendarEvent[]>()
  for (const event of events) {
    const start = startOfDay(new Date(event.start))
    const end = startOfDay(new Date(event.end))
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue

    const lastDay = end < start ? start : end
    const cursor = new Date(start)
    while (cursor <= lastDay) {
      const key = dateKey(cursor)
      const dayEvents = eventsByDay.get(key) ?? []
      dayEvents.push(event)
      eventsByDay.set(key, dayEvents)
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstGridDay)
    date.setDate(firstGridDay.getDate() + index)
    const key = dateKey(date)
    return {
      date,
      key,
      events: (eventsByDay.get(key) ?? []).sort(
        (left, right) => new Date(left.start).getTime() - new Date(right.start).getTime(),
      ),
    }
  })
}

function eventKinds(events: MonthlyCalendarEvent[]): EventKind[] {
  return Array.from(new Set(events
    .map((event) => eventKindVisual(event.eventKind)?.className.split('--')[1] as EventKind | undefined)
    .filter((kind): kind is EventKind => Boolean(kind))))
}

export default function MonthlyMobileCalendar({
  currentDate,
  events,
  onNavigate,
  onEventClick,
  onCreateEvent,
  renderAgendaEvent,
}: {
  currentDate: Date
  events: MonthlyCalendarEvent[]
  onNavigate: (action: 'prev' | 'next' | 'today') => void
  onEventClick?: (id: string) => void
  onCreateEvent?: (date: Date) => void
  renderAgendaEvent?: (event: MonthlyCalendarEvent) => ReactNode
}) {
  const days = useMemo(() => buildMonthDays(currentDate, events), [currentDate, events])
  const currentMonth = currentDate.getMonth()
  const [selectedDayKey, setSelectedDayKey] = useState(() => dateKey(startOfDay(currentDate)))

  useEffect(() => {
    setSelectedDayKey(dateKey(startOfDay(currentDate)))
  }, [currentDate])

  const selectedDay = days.find((day) => day.key === selectedDayKey) ?? days.find((day) => day.date.getMonth() === currentMonth) ?? days[0]
  const today = startOfDay(new Date())

  return (
    <section className="cs-mobile-month-calendar" aria-label="Calendario mensile">
      <div className="cs-mobile-month-calendar__toolbar">
        <button type="button" className="cs-btn cs-btn--sm cs-btn--ghost" onClick={() => onNavigate('today')}>
          Oggi
        </button>
        <div className="flex items-center gap-1">
          <button type="button" className="cs-btn cs-btn--icon" onClick={() => onNavigate('prev')} aria-label="Mese precedente">‹</button>
          <h3 className="min-w-[150px] text-center text-sm font-bold capitalize">
            {currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
          </h3>
          <button type="button" className="cs-btn cs-btn--icon" onClick={() => onNavigate('next')} aria-label="Mese successivo">›</button>
        </div>
      </div>

      <div className="cs-mobile-month-calendar__weekdays" aria-hidden="true">
        {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
      </div>

      <div className="cs-mobile-month-calendar__legend" aria-label="Legenda tipi evento">
        {EVENT_KIND_OPTIONS.map(({ value, label }) => {
          const visual = eventKindVisual(value)
          return visual ? (
            <span key={value}>
              <span className="cs-mobile-month-calendar__agenda-kind" style={{ backgroundColor: visual.colorToken }} aria-hidden="true" />
              {label}
            </span>
          ) : null
        })}
      </div>

      <div className="cs-mobile-month-calendar__grid" role="group" aria-label={`Giorni di ${currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}`}>
        {days.map((day) => {
          const isSelected = day.key === selectedDay?.key
          const isToday = isSameDay(day.date, today)
          const isOtherMonth = day.date.getMonth() !== currentMonth
          const kinds = eventKinds(day.events)
          const previewEvents = day.events.slice(0, PREVIEW_LIMIT)

          return (
            <button
              key={day.key}
              type="button"
              aria-pressed={isSelected}
              aria-label={`${formatDay(day.date)}${day.events.length ? `, ${day.events.length} eventi` : ', nessun evento'}`}
              className={`cs-mobile-month-calendar__day${isSelected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}${isOtherMonth ? ' is-other-month' : ''}`}
              onClick={() => setSelectedDayKey(day.key)}
            >
              <span className="cs-mobile-month-calendar__date">{day.date.getDate()}</span>
              <span className="cs-mobile-month-calendar__indicators" aria-hidden="true">
                {kinds.map((kind) => <span key={kind} className={`cs-mobile-month-calendar__indicator cs-event-kind--${kind}`} />)}
              </span>
              {previewEvents.length > 0 && (
                <span className="cs-mobile-month-calendar__preview" aria-hidden="true">
                  {previewEvents.map((event) => <span key={event.id}>{event.title}</span>)}
                  {day.events.length > PREVIEW_LIMIT && <span>+{day.events.length - PREVIEW_LIMIT} altri</span>}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="cs-mobile-month-calendar__agenda" aria-live="polite">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h4 className="text-base font-bold capitalize">{selectedDay ? formatDay(selectedDay.date) : 'Agenda'}</h4>
          <span className="text-xs text-secondary">{selectedDay?.events.length ?? 0} eventi</span>
        </div>
        {selectedDay && selectedDay.events.length > 0 ? (
          <div className="divide-y divide-[color:var(--cs-border-subtle)] overflow-hidden rounded-[var(--cs-radius-md)] border border-[color:var(--cs-border-subtle)]">
            {selectedDay.events.map((event) => {
              if (renderAgendaEvent) return <div key={event.id}>{renderAgendaEvent(event)}</div>

              const visual = eventKindVisual(event.eventKind)
              return (
                <button
                  key={event.id}
                  type="button"
                  className="flex min-h-[60px] w-full items-start gap-3 bg-[color:var(--cs-surface-1)] px-3 py-3 text-left transition-colors hover:bg-[color:var(--cs-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--cs-focus-ring)]"
                  onClick={() => onEventClick?.(event.id)}
                >
                  <span className="w-12 shrink-0 pt-0.5 text-xs font-semibold tabular-nums text-secondary">{formatTime(event.start)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{event.title}</span>
                    <span className="mt-1 flex items-center gap-2 text-xs text-secondary">
                      {visual && <span className="cs-mobile-month-calendar__agenda-kind" style={{ backgroundColor: visual.colorToken }} aria-hidden="true" />}
                      <span>{visual?.label ?? 'Tipo non disponibile'}</span>
                      {event.location && <span className="truncate">· {event.location}</span>}
                    </span>
                  </span>
                  <span aria-hidden="true" className="pt-1 text-secondary">›</span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="rounded-[var(--cs-radius-md)] border border-dashed border-[color:var(--cs-border)] px-3 py-4">
            <p className="text-sm text-secondary">Nessun evento in questa giornata.</p>
            {onCreateEvent && selectedDay && (
              <button
                type="button"
                className="cs-btn cs-btn--sm cs-btn--outline mt-3"
                onClick={() => onCreateEvent(selectedDay.date)}
              >
                Nuovo evento per questa giornata
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
