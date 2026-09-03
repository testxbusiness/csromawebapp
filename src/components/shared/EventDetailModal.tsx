"use client"

import * as React from 'react'
import { CalendarDays } from 'lucide-react'
import { ErrorState, LoadingState, ResponsiveDetail } from '@/components/ui'
import AttendanceControl from '@/components/athlete/AttendanceControl'
import type { AttendanceStatus } from '@/types/attendance'

type TeamLike = { id?: string; name: string; code?: string | null } | string
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
  requires_confirmation?: boolean
  confirmation_deadline?: string | null
  my_attendance?: { status?: AttendanceStatus; responded_at?: string | null } | null
}

type EventDetailModalProps = {
  open: boolean
  onClose: () => void
  data: EventDetailData | null
  onAttendanceChange?: (status: AttendanceStatus) => Promise<void>
  canRespond?: boolean
  error?: string | null
  onRetry?: () => void
  children?: React.ReactNode
}

export default function EventDetailModal({ open, onClose, data, onAttendanceChange, canRespond = true, error = null, onRetry, children }: EventDetailModalProps) {
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

  const humanKind = (kind?: string) => ({
    training: 'Allenamento',
    match: 'Partita',
    meeting: 'Riunione',
    other: 'Altro',
  } as Record<string, string>)[kind ?? ''] ?? kind ?? ''

  const place = (d: EventDetailData | null) => {
    if (!d) return '—'
    if (d.location && d.location.trim()) return d.location
    if (d.gym?.name) return d.gym.city ? `${d.gym.name} - ${d.gym.city}` : d.gym.name
    return '—'
  }

  return (
    <ResponsiveDetail
      open={open}
      onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}
      title={
        <span className="cs-detail-heading">
          <span className="cs-detail-heading__icon" aria-hidden="true"><CalendarDays size={24} /></span>
          <span className="cs-detail-heading__copy">
            <span className="cs-detail-heading__eyebrow">Dettaglio evento</span>
            <span className="cs-detail-heading__title">{data?.title ?? 'Dettaglio evento'}</span>
            {data?.event_kind ? <span className="cs-detail-heading__subtitle">{humanKind(data.event_kind)}</span> : null}
          </span>
        </span>
      }
      description={<span className="sr-only">Informazioni sull’evento</span>}
      size="lg"
      centeredOnMobile
    >
      {error ? (
        <ErrorState
          title="Impossibile caricare il dettaglio"
          description={error}
          action={onRetry ? <button type="button" className="cs-btn cs-btn--outline" onClick={onRetry}>Riprova</button> : undefined}
        />
      ) : !data ? (
            <LoadingState label="Caricamento evento..." />
          ) : (
            <div className="grid grid-cols-1 gap-4 min-[380px]:grid-cols-2">
              {/* Orario */}
              <div id="event-detail-time">
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
              <div id="event-detail-place">
                <div className="text-secondary" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.02em' }}>Luogo</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconMapPin />
                  <div>{place(data)}</div>
                </div>
              </div>

              {/* Squadre */}
              {!!(data.teams?.length) && (
                <div id="event-detail-teams">
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
                <div id="event-detail-creator">
                  <div className="text-secondary" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.02em' }}>Creata da</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <IconPencil />
                    <div>{[data.creator?.first_name, data.creator?.last_name].filter(Boolean).join(' ') || '—'}</div>
                  </div>
                </div>
              )}

              {/* Descrizione */}
              {data.description && (
                <div className="sm:col-span-2" id="event-detail-description">
                  <div className="text-secondary" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.02em' }}>Descrizione</div>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{data.description}</p>
                </div>
              )}

              {data.requires_confirmation && onAttendanceChange && (
                <div className="sm:col-span-2" id="event-detail-attendance">
                  <AttendanceControl
                    requiresConfirmation
                    confirmationDeadline={data.confirmation_deadline}
                    initialStatus={data.my_attendance?.status ?? null}
                    canRespond={canRespond}
                    onChange={onAttendanceChange}
                  />
                </div>
              )}
            </div>
          )}
      {children}
    </ResponsiveDetail>
  )
}
