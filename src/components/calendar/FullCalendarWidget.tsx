'use client'

import React, { useMemo, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import itLocale from '@fullcalendar/core/locales/it'

export type CalEvent = {
  id: string
  title: string
  start: Date | string
  end: Date | string
  color?: string
}

type View = 'month' | 'week'

export default function FullCalendarWidget({
  initialDate,
  view,
  events,
  onNavigate,
  onViewChange,
  onEventClick,
  onSelectSlot,
}: {
  initialDate: Date
  view: View
  events: CalEvent[]
  onNavigate: (action: 'prev' | 'next' | 'today') => void
  onViewChange: (view: View) => void
  onEventClick?: (id: string) => void
  onSelectSlot?: (start: Date, end: Date) => void
}) {
  const calendarRef = useRef<FullCalendar | null>(null)

  const fcEvents = useMemo(() => events.map(e => ({
    id: e.id,
    title: e.title,
    start: e.start,
    end: e.end,
    color: e.color,
  })), [events])

  const initialView = view === 'month' ? 'dayGridMonth' : 'timeGridWeek'

  return (
    <div className="calendar-responsive">
      <div className="fc cs-card cs-card--primary p-2">
        <FullCalendar
        ref={calendarRef as any}
        locales={[itLocale]}
        locale="it"
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={initialView}
        initialDate={initialDate}
        headerToolbar={{
          left: 'today,prev,next',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek',
        }}
        height="auto"
        events={fcEvents}
        selectable={true}
        selectMirror={true}
        select={(info) => {
          onSelectSlot?.(new Date(info.start), new Date(info.end))
        }}
        eventClick={(info) => {
          const id = info.event.id
          if (id) onEventClick?.(id)
        }}
        datesSet={(arg) => {
          const newView = arg.view.type === 'timeGridWeek' ? 'week' : 'month'
          onViewChange(newView)
        }}
      />
      </div>
    </div>
  )
}
