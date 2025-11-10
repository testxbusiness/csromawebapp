"use client"

import * as React from 'react'
import { createPortal } from 'react-dom'

type TrainingSchedule = {
  day_of_week: number
  start_time: string
  end_time: string
  gym: {
    name: string
    city?: string
  }
}

type Athlete = {
  id: string
  first_name: string
  last_name: string
  jersey_number?: number
}

type Coach = {
  id: string
  first_name: string
  last_name: string
  role: string
}

export type TeamDetailData = {
  name: string
  code: string
  activity?: { name: string }
  training_schedules?: TrainingSchedule[]
  athletes?: Athlete[]
  coaches?: Coach[]
}

export default function TeamDetailModal({
  open,
  onClose,
  data
}: {
  open: boolean
  onClose: () => void
  data: TeamDetailData | null
}) {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => { setMounted(true) }, [])

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

  const IconShield = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="none" stroke="currentColor" strokeWidth={2}/>
    </svg>
  )

  const IconCalendar = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth={2}/>
      <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth={2}/>
    </svg>
  )

  const getDayName = (dayOfWeek: number): string => {
    const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
    return days[dayOfWeek] || 'N/D'
  }

  const formatTime = (time: string): string => {
    // time può essere "18:00:00" o "18:00"
    const parts = time.split(':')
    return `${parts[0]}:${parts[1]}`
  }

  const getRoleLabel = (role: string): string => {
    const roles: Record<string, string> = {
      'head_coach': 'Primo Allenatore',
      'assistant_coach': 'Secondo Allenatore',
      'trainer': 'Preparatore',
      'manager': 'Manager'
    }
    return roles[role] || role
  }

  if (!mounted || !open) return null

  return createPortal(
    <div
      className="cs-overlay"
      aria-hidden={open ? 'false' : 'true'}
      style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', padding: 16, zIndex: 100 }}
    >
      <section
        role="dialog"
        aria-modal="true"
        className="cs-modal cs-modal--md"
        data-state={open ? 'open' : 'closed'}
        style={{ maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto' }}
      >
        <button className="cs-modal__close" aria-label="Chiudi" onClick={onClose}><IconX /></button>

        <div className="cs-modal__header" style={{ alignItems: 'center', gap: 12 }}>
          <div className="cs-modal__icon" aria-hidden>⚽</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="cs-modal__title">Dettaglio Squadra</h2>
            {data?.name && <div style={{ marginTop: 4, fontWeight: 600 }}>{data.name}</div>}
            <div className="text-secondary" style={{ fontSize: 12, marginTop: 2 }}>
              Codice: {data?.code || 'N/D'}
              {data?.activity?.name && ` • ${data.activity.name}`}
            </div>
          </div>
        </div>

        {!data ? (
          <div className="p-4 text-secondary text-sm">Caricamento…</div>
        ) : (
          <div className="cs-grid" style={{ gap: 16, gridTemplateColumns: '1fr' }}>

            {/* Orari Allenamento */}
            {data.training_schedules && data.training_schedules.length > 0 && (
              <div>
                <div className="text-secondary" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.02em', marginBottom: 8 }}>
                  <IconCalendar style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                  Orari Allenamento
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {data.training_schedules.map((schedule, idx) => (
                    <div key={idx} className="cs-card cs-card--primary" style={{ padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 150 }}>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>
                            {getDayName(schedule.day_of_week)}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                            <IconClock style={{ width: 14, height: 14 }} />
                            <span>{formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                          <IconMapPin style={{ width: 14, height: 14 }} />
                          <span>{schedule.gym.city ? `${schedule.gym.name}, ${schedule.gym.city}` : schedule.gym.name}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Staff Tecnico */}
            {data.coaches && data.coaches.length > 0 && (
              <div>
                <div className="text-secondary" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.02em', marginBottom: 8 }}>
                  <IconShield style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                  Staff Tecnico
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {data.coaches.map((coach) => (
                    <div key={coach.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--cs-surface-secondary)', borderRadius: 8 }}>
                      <span style={{ fontWeight: 500 }}>
                        {coach.first_name} {coach.last_name}
                      </span>
                      <span className="cs-badge cs-badge--accent" style={{ fontSize: 11 }}>
                        {getRoleLabel(coach.role)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Atleti */}
            {data.athletes && data.athletes.length > 0 && (
              <div>
                <div className="text-secondary" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.02em', marginBottom: 8 }}>
                  <IconUsers style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                  Atleti ({data.athletes.length})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6, maxHeight: 300, overflowY: 'auto', padding: 4 }}>
                  {data.athletes.map((athlete) => (
                    <div key={athlete.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--cs-surface-secondary)', borderRadius: 6, fontSize: 14 }}>
                      {athlete.jersey_number && (
                        <span style={{ fontWeight: 700, color: 'var(--cs-primary)', minWidth: 24 }}>
                          #{athlete.jersey_number}
                        </span>
                      )}
                      <span>
                        {athlete.first_name} {athlete.last_name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Messaggi vuoti */}
            {(!data.training_schedules || data.training_schedules.length === 0) &&
             (!data.coaches || data.coaches.length === 0) &&
             (!data.athletes || data.athletes.length === 0) && (
              <div className="text-secondary text-sm text-center py-8">
                Nessuna informazione disponibile per questa squadra
              </div>
            )}

          </div>
        )}
      </section>
    </div>,
    document.body
  )
}
