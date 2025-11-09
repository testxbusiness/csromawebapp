'use client'

import * as React from 'react'
import Link from 'next/link'

type EventItem = {
  id: string
  title: string
  start: Date
  end?: Date
  location?: string | null
  kind?: string | null
  subtitle?: string | null
}

export default function UpcomingEventsPanel({
  title = 'Prossimi Eventi',
  items,
  emptyText = 'Nessun evento programmato',
  viewAllHref,
  onDetail,
}: {
  title?: string
  items: EventItem[]
  emptyText?: string
  viewAllHref: string
  onDetail: (id: string) => void
}) {
  const IconPin = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...props}><path d="M12 22s8-5.33 8-12a8 8 0 10-16 0c0 6.67 8 12 8 12z" fill="none" stroke="currentColor" strokeWidth={2}/><circle cx="12" cy="10" r="3" fill="none" stroke="currentColor" strokeWidth={2}/></svg>
  )

  const fmtDay = (d: Date) => String(d.getDate()).padStart(2,'0')
  const fmtMon = (d: Date) => d.toLocaleDateString('it-IT', { month: 'short' }).toUpperCase()

  return (
    <div className="cs-card cs-card--primary">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">{title}</h3>
        <Link href={viewAllHref} className="cs-btn cs-btn--ghost cs-btn--sm">Vedi tutti</Link>
      </div>

      {items.length === 0 ? (
        <p className="text-secondary text-sm">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {items.map((ev) => (
            <div key={ev.id} className="cs-card p-3 flex items-start gap-3">
              {/* Date badge */}
              <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-[color:var(--cs-surface-2)] text-sm" aria-hidden>
                <div className="font-bold leading-none">{fmtDay(ev.start)}</div>
                <div className="text-[10px] text-secondary">{fmtMon(ev.start)}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-medium truncate">{ev.title}</div>
                  {ev.kind && <span className="cs-badge cs-badge--neutral">{ev.kind}</span>}
                  <span className="text-xs text-secondary">{ev.start.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}{ev.end ? ` — ${ev.end.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}` : ''}</span>
                </div>
                {ev.location && (
                  <div className="text-sm flex items-center gap-1"><IconPin /> {ev.location}</div>
                )}
                {ev.subtitle && (
                  <div className="text-sm text-secondary truncate">{ev.subtitle}</div>
                )}
              </div>
              <div>
                <button className="cs-btn cs-btn--outline cs-btn--sm" onClick={() => onDetail(ev.id)}>Dettagli</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

