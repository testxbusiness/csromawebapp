'use client'

import * as React from 'react'

type TeamLike = { id?: string; name: string } | string

export type EventDetailData = {
  title?: string
  event_kind?: 'training'|'match'|'meeting'|'other'|string
  start_date?: string
  end_date?: string
  location?: string
  gym?: { name: string; city?: string } | null
  teams?: TeamLike[]
  creator?: { first_name?: string; last_name?: string } | null
  description?: string | null
}

export default function EventDetailModal({ open, onClose, data }: { open: boolean; onClose: () => void; data: EventDetailData | null }) {
  const IconX = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/>
    </svg>
  )
  const IconClock = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth={2}/>
      <path d="M12 7v6l4 2" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/>
    </svg>
  )
  const IconMapPin = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
      <path d="M12 22s8-5.33 8-12a8 8 0 10-16 0c0 6.67 8 12 8 12z" fill="none" stroke="currentColor" strokeWidth={2}/>
      <circle cx="12" cy="10" r="3" fill="none" stroke="currentColor" strokeWidth={2}/>
    </svg>
  )
  const IconUsers = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
      <path d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2" fill="none" stroke="currentColor" strokeWidth={2}/>
      <circle cx="9" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth={2}/>
      <path d="M23 21v-2a4 4 0 00-3-3.87" fill="none" stroke="currentColor" strokeWidth={2}/>
      <path d="M16 3.13a4 4 0 010 7.75" fill="none" stroke="currentColor" strokeWidth={2}/>
    </svg>
  )
  const IconPencil = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
      <path d="M12 20h9" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/>
      <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" fill="none" stroke="currentColor" strokeWidth={2}/>
    </svg>
  )

  const humanKind = (k?: string) => ({ training:'Allenamento', match:'Partita', meeting:'Riunione', other:'Altro' } as any)[k || ''] || k || ''

  const place = (d: EventDetailData | null) => {
    if (!d) return '—'
    if (d.location && d.location.trim()) return d.location
    if (d.gym?.name) return d.gym.city ? `${d.gym.name} - ${d.gym.city}` : d.gym.name
    return '—'
  }

  return (
    <div className="cs-overlay" aria-hidden={open ? 'false' : 'true'}>
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', padding: 16 }}>
      <section role="dialog" aria-modal="true" className="cs-modal cs-modal--md cs-modal--centered" data-state={open ? 'open' : 'closed'}>
        <button className="cs-modal__close" aria-label="Chiudi" onClick={onClose}><IconX /></button>

        <div className="cs-modal__header" style={{ alignItems: 'center', gap: 12 }}>
          <div className="cs-modal__icon" aria-hidden>📅</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="cs-modal__title">Dettaglio Evento</h2>
            {data?.title && <div style={{ marginTop: 4, fontWeight: 600 }}>{data.title}</div>}
            {data?.event_kind && <div className="text-secondary" style={{ fontSize: 12 }}>{humanKind(data.event_kind)}</div>}
          </div>
        </div>

        {!data ? (
          <div className="p-4 text-secondary text-sm">Caricamento…</div>
        ) : (
          <div className="cs-grid" style={{ gap: 16, gridTemplateColumns: '1fr 1fr' }}>
            {/* Orario */}
            <div>
              <div className="text-secondary" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.02em' }}>Orario</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconClock />
                <div>
                  <div><strong>Inizio:</strong> {data.start_date ? new Date(data.start_date).toLocaleString('it-IT') : '—'}</div>
                  <div><strong>Fine:</strong> {data.end_date ? new Date(data.end_date).toLocaleString('it-IT') : '—'}</div>
                </div>
              </div>
            </div>

            {/* Luogo */}
            <div>
              <div className="text-secondary" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.02em' }}>Luogo</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconMapPin />
                <div>{place(data)}</div>
              </div>
            </div>

            {/* Squadre */}
            {!!(data.teams?.length) && (
              <div>
                <div className="text-secondary" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.02em' }}>Squadre</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <IconUsers />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {data.teams!.map((t, i) => (
                      <span key={i} className="cs-badge cs-badge--neutral">{typeof t === 'string' ? t : (t.name || '')}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Creato da */}
            {data.creator && (
              <div>
                <div className="text-secondary" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.02em' }}>Creata da</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconPencil />
                  <div>{[data.creator?.first_name, data.creator?.last_name].filter(Boolean).join(' ') || '—'}</div>
                </div>
              </div>
            )}

            {/* Descrizione */}
            {data.description && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div className="text-secondary" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.02em' }}>Descrizione</div>
                <p style={{ whiteSpace: 'pre-wrap' }}>{data.description}</p>
              </div>
            )}
          </div>
        )}
      </section>
      </div>
    </div>
  )
}
