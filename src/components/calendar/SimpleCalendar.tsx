'use client'

import { useMemo, useState, useCallback } from 'react'

export type CalEvent = {
  id: string
  title: string
  start: Date
  end: Date
  color?: string
}

type View = 'month' | 'week'

export default function SimpleCalendar({
  currentDate,
  view,
  events,
  onNavigate,
  onViewChange,
  onEventClick,
  onDayClick,         // (opz.) click su giorno
  timezone = 'Europe/Rome', // (opz.) per toLocale*
}: {
  currentDate: Date
  view: View
  events: CalEvent[]
  onNavigate: (action: 'prev' | 'next' | 'today') => void
  onViewChange: (view: View) => void
  onEventClick?: (id: string) => void
  onDayClick?: (date: Date) => void
  timezone?: string
}) {
  // ===== Utils
  const startOfWeek = (d: Date) => {
    const date = new Date(d)
    const day = (date.getDay() + 6) % 7 // Monday=0
    date.setDate(date.getDate() - day)
    date.setHours(0, 0, 0, 0)
    return date
  }

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

  const dateKey = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const getTextColorForBg = (hex?: string) => {
    // fallback brand
    const h = (hex || '#2563eb').replace('#','')
    const bigint = parseInt(h.length === 3 ? h.split('').map(c=>c+c).join('') : h, 16)
    const r = (bigint >> 16) & 255
    const g = (bigint >> 8) & 255
    const b = bigint & 255
    // luminanza percettiva
    const L = 0.299*r + 0.587*g + 0.114*b
    return L > 140 ? '#111827' : '#ffffff'
  }

  // ===== Inizio/fine periodo
  const start = useMemo(() => {
    if (view === 'week') return startOfWeek(currentDate)
    const d = new Date(currentDate)
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d
  }, [currentDate, view])

  const days = useMemo(() => {
    const out: Date[] = []
    if (view === 'week') {
      for (let i = 0; i < 7; i++) {
        const d = new Date(start)
        d.setDate(start.getDate() + i)
        out.push(d)
      }
    } else {
      const d = new Date(start)
      const firstDayIdx = (d.getDay() + 6) % 7
      d.setDate(d.getDate() - firstDayIdx)
      for (let i = 0; i < 42; i++) {
        const nd = new Date(d)
        nd.setDate(d.getDate() + i)
        out.push(nd)
      }
    }
    return out
  }, [start, view])

  // ===== Mappatura eventi per giorno (gestisce multi-giorno)
  const eventsByDay = useMemo(() => {
    const map: Record<string, CalEvent[]> = {}
    for (const ev of events) {
      const cur = new Date(ev.start)
      const end = new Date(ev.end)
      cur.setHours(0,0,0,0)
      end.setHours(0,0,0,0)

      while (cur <= end) {
        const k = dateKey(cur)
        ;(map[k] ||= []).push(ev)
        cur.setDate(cur.getDate() + 1)
      }
    }
    // ordina per orario di inizio
    Object.values(map).forEach(arr => arr.sort((a,b)=> a.start.getTime() - b.start.getTime()))
    return map
  }, [events])

  // ===== Label intestazione
  const monthLabel = currentDate.toLocaleDateString('it-IT', {
    month: 'long', year: 'numeric', timeZone: timezone,
  })

  // ===== UI state per overflow “+N”
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const toggleDay = useCallback((k: string) => {
    setExpanded(prev => ({ ...prev, [k]: !prev[k] }))
  }, [])

  const monthBtnClass = 'cs-btn cs-btn--sm ' + (view === 'month' ? 'cs-btn--primary' : 'cs-btn--ghost')
  const weekBtnClass  = 'cs-btn cs-btn--sm ' + (view === 'week'  ? 'cs-btn--primary' : 'cs-btn--ghost')

  const today = useMemo(() => {
    const t = new Date()
    t.setHours(0,0,0,0)
    return t
  }, [])

  // ===== RENDER
  return (
    <div className="space-y-3" role="region" aria-label="Calendario">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={() => onNavigate('today')} className="cs-btn cs-btn--sm cs-btn--ghost" aria-label="Vai a oggi">Oggi</button>
          <button onClick={() => onNavigate('prev')} className="cs-btn cs-btn--sm cs-btn--ghost" aria-label="Precedente">←</button>
          <button onClick={() => onNavigate('next')} className="cs-btn cs-btn--sm cs-btn--ghost" aria-label="Successivo">→</button>
        </div>
        <div className="font-semibold capitalize tracking-wide">{monthLabel}</div>
        <div className="flex gap-2">
          <button onClick={() => onViewChange('month')} className={monthBtnClass}>Mese</button>
          <button onClick={() => onViewChange('week')}  className={weekBtnClass}>Settimana</button>
        </div>
      </div>

      {/* Intestazione giorni */}
      <div className="grid grid-cols-7 gap-1 px-1">
        {['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map((d) => (
          <div key={d} className="text-xs text-secondary px-2 pb-1 select-none">{d}</div>
        ))}
      </div>

      {view === 'month' ? (
        // ====================== MONTH VIEW ======================
        <div
          role="grid"
          aria-readonly
          className="grid grid-cols-7 gap-1"
        >
          {days.map((d, idx) => {
            const isOtherMonth = d.getMonth() !== currentDate.getMonth()
            const isToday = isSameDay(d, today)
            const k = dateKey(d)
            const list = eventsByDay[k] || []
            const maxVisible = 3
            const showAll = !!expanded[k]
            const visible = showAll ? list : list.slice(0, maxVisible)
            const hiddenCount = Math.max(list.length - visible.length, 0)

            return (
              <div
                key={idx}
                role="rowgroup"
                className={[
                  'min-h-[110px] border rounded p-1 transition-colors',
                  isOtherMonth ? 'bg-[color:var(--cs-surface-2)] opacity-80' : 'bg-[color:var(--cs-surface-1)]',
                  'hover:bg-[color:var(--cs-surface-hover)]',
                  isToday ? 'ring-2 ring-[color:var(--cs-primary)]' : '',
                ].join(' ')}
              >
                {/* Day header */}
                <div className="flex items-center justify-between mb-1">
                  <button
                    type="button"
                    onClick={() => onDayClick?.(d)}
                    className={[
                      'text-xs px-1 py-0.5 rounded',
                      isToday ? 'bg-[color:var(--cs-primary)] text-white' : 'text-secondary hover:bg-black/5'
                    ].join(' ')}
                    aria-label={d.toLocaleDateString('it-IT', { day:'numeric', month:'long', year:'numeric', timeZone: timezone })}
                    title={d.toLocaleDateString('it-IT', { weekday:'long', day:'numeric', month:'long', timeZone: timezone })}
                  >
                    {d.getDate()}
                  </button>

                  {list.length > 0 && (
                    <span className="text-[10px] text-secondary">{list.length} evento{list.length>1?'i':''}</span>
                  )}
                </div>

                {/* Events */}
                <div className="space-y-1">
                  {visible.map(ev => {
                    const bg = ev.color || '#2563eb'
                    const fg = getTextColorForBg(ev.color)
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => onEventClick?.(ev.id)}
                        className="w-full text-left truncate text-[11px] px-1 py-0.5 rounded hover:opacity-90"
                        style={{ backgroundColor: bg, color: fg }}
                        title={`${ev.title} — ${ev.start.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit', timeZone: timezone})}`}
                        aria-label={ev.title}
                      >
                        {ev.title}
                      </button>
                    )
                  })}

                  {hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleDay(k)}
                      className="w-full text-left text-[11px] px-1 py-0.5 rounded border border-dashed hover:bg-black/5"
                      aria-expanded={showAll}
                    >
                      {showAll ? 'Mostra meno' : `+${hiddenCount} altri`}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        // ====================== WEEK VIEW (time grid) ======================
        <WeekTimeGrid
          weekDays={days}
          events={events}
          onEventClick={onEventClick}
          timezone={timezone}
        />
      )}
    </div>
  )
}

/* ====== WEEK GRID component (semplice, leggibile, con posizionamento per orario) ====== */
function WeekTimeGrid({
  weekDays,
  events,
  onEventClick,
  timezone,
}: {
  weekDays: Date[]
  events: CalEvent[]
  onEventClick?: (id: string) => void
  timezone: string
}) {
  // fascia oraria visibile
  const startHour = 8
  const endHour   = 20

  // eventi della settimana, segmentati per giorno e con style inline (top/height)
  const data = useMemo(() => {
    const byDay: Record<string, Array<CalEvent & { topPct:number; heightPct:number }>> = {}
    for (const day of weekDays) {
      const k = day.toDateString()
      byDay[k] = []
      const dayStart = new Date(day); dayStart.setHours(0,0,0,0)
      const dayEnd   = new Date(day); dayEnd.setHours(23,59,59,999)

      const todaysEvents = events.filter(ev => !(ev.end < dayStart || ev.start > dayEnd))
      for (const ev of todaysEvents) {
        const s = new Date(Math.max(ev.start.getTime(), new Date(day.setHours(startHour,0,0,0)).getTime()))
        const e = new Date(Math.min(ev.end.getTime(), new Date(new Date(day).setHours(endHour,0,0,0)).getTime()))
        const totalMins = (endHour - startHour) * 60
        const startMins = (s.getHours() - startHour) * 60 + s.getMinutes()
        const endMins   = (e.getHours() - startHour) * 60 + e.getMinutes()
        const topPct    = Math.max(0, (startMins / totalMins) * 100)
        const heightPct = Math.max(8, ((endMins - startMins) / totalMins) * 100) // min height 8%
        byDay[k].push({ ...ev, topPct, heightPct })
      }
    }
    return byDay
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(weekDays.map(d=>d.toDateString())), JSON.stringify(events)])

  return (
    <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-1">
      {/* Orari colonna */}
      <div className="flex flex-col">
        {[...Array(endHour - startHour + 1)].map((_,i) => {
          const h = startHour + i
          return (
            <div key={h} className="h-16 text-[10px] text-right pr-2 text-secondary">
              {String(h).padStart(2,'0')}:00
            </div>
          )
        })}
      </div>

      {/* 7 colonne giornaliere */}
      {weekDays.map((d) => {
        const key = d.toDateString()
        const dayLabel = d.toLocaleDateString('it-IT',{ weekday:'short', day:'numeric', timeZone: timezone })
        const todays = data[key] || []

        return (
          <div key={key} className="relative border rounded overflow-hidden bg-[color:var(--cs-surface-1)]">
            {/* Righe orarie */}
            {[...Array(endHour - startHour)].map((_,i) => (
              <div key={i} className="h-16 border-b border-dashed/50" />
            ))}
            {/* Header compatto (sticky) */}
            <div className="absolute top-0 left-0 right-0 text-[11px] font-medium px-2 py-1 bg-[color:var(--cs-surface-1)]/90 backdrop-blur">
              {dayLabel}
            </div>

            {/* Eventi posizionati */}
            {todays.map(ev => {
              const bg = ev.color || '#2563eb'
              const fg = (function(){
                const c = bg.replace('#','')
                const v = parseInt(c.length===3? c.split('').map(x=>x+x).join(''): c, 16)
                const r = (v>>16)&255, g=(v>>8)&255, b=v&255
                return (0.299*r+0.587*g+0.114*b) > 140 ? '#111827' : '#ffffff'
              })()
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onEventClick?.(ev.id)}
                  className="absolute left-1 right-1 rounded px-2 text-left text-[11px] shadow-sm hover:opacity-90 focus:outline-none focus:ring-2"
                  style={{ top: `${ev.topPct}%`, height: `${ev.heightPct}%`, backgroundColor: bg, color: fg }}
                  title={`${ev.title} — ${ev.start.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit', timeZone: timezone})} → ${ev.end.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit', timeZone: timezone})}`}
                >
                  <div className="font-medium truncate">{ev.title}</div>
                  <div className="opacity-90">
                    {ev.start.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit', timeZone: timezone})}
                    {' — '}
                    {ev.end.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit', timeZone: timezone})}
                  </div>
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
