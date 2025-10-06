// src/components/athlete/AthleteCalendarManager.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import DetailsDrawer from '@/components/shared/DetailsDrawer'
import SimpleCalendar, { CalEvent } from '@/components/calendar/SimpleCalendar'
import { useAuth } from '@/hooks/useAuth'
import { exportEvents } from '@/lib/utils/excelExport'

type EventKind = 'training'|'match'|'meeting'|'other'

interface Event {
  id: string
  title: string
  description?: string
  location?: string
  start_time: string
  end_time: string
  is_recurring: boolean
  teams: string[]         // team names
  event_kind?: EventKind
}

interface TeamLite { id: string; name: string; code: string }

function kindColor(kind?: string) {
  switch (kind) {
    case 'training': return '#16a34a'
    case 'match':    return '#dc2626'
    case 'meeting':  return '#2563eb'
    default:         return '#6b7280'
  }
}

export default function AthleteCalendarManager() {
  const { user } = useAuth()
  const supabase = createClient()

  const [events, setEvents] = useState<Event[]>([])
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [teamMemberships, setTeamMemberships] = useState<TeamLite[]>([])
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)

  const [viewMode, setViewMode] = useState<'list'|'calendar'>('list')
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [calView, setCalView] = useState<'month'|'week'>('month')

  useEffect(() => { if (user) void loadData() }, [user])
  useEffect(() => { setFilteredEvents(events) }, [events])

  async function loadData() {
    setLoading(true)
    try {
      const memberships = await loadTeamMemberships()
      const teamIds = memberships.map(m => m.id)
      await loadEvents(teamIds, memberships)    // passiamo anche i nomi per evitare race sullo stato
    } finally {
      setLoading(false)
    }
  }

  async function loadTeamMemberships(): Promise<TeamLite[]> {
    const { data: memberships, error } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('profile_id', user?.id)

    if (error) {
      console.error('Error loading athlete team memberships:', error)
      setTeamMemberships([])
      return []
    }

    const teamIds = [...new Set((memberships || []).map(m => m.team_id).filter(Boolean))]
    if (teamIds.length === 0) { setTeamMemberships([]); return [] }

    const { data: teams, error: teamsErr } = await supabase
      .from('teams')
      .select('id, name, code')
      .in('id', teamIds)

    if (teamsErr) {
      console.error('Error loading teams for athlete:', teamsErr)
      setTeamMemberships([])
      return []
    }

    const mapped = (teams || []).map(t => ({ id: t.id, name: t.name, code: t.code }))
    setTeamMemberships(mapped)
    return mapped
  }

  async function loadEvents(teamIds: string[], membershipTeams: TeamLite[]) {
    if (!teamIds?.length) { setEvents([]); return }

    // 1) relazioni evento-squadre per le squadre dell’atleta
    const { data: relations, error: relErr } = await supabase
      .from('event_teams')
      .select('event_id, team_id')
      .in('team_id', teamIds)

    if (relErr) {
      console.error('Error loading event-team relations for athlete:', relErr)
      setEvents([])
      return
    }

    const eventIds = [...new Set((relations || []).map(r => r.event_id))]
    if (eventIds.length === 0) { setEvents([]); return }

    // 2) eventi
    const { data: rows, error: evErr } = await supabase
      .from('events')
      .select('id, title, description, location, start_time:start_date, end_time:end_date, event_type, event_kind')
      .in('id', eventIds)
      .order('start_date', { ascending: true })

    if (evErr) {
      console.error('Error loading events for athlete:', evErr)
      setEvents([])
      return
    }

    // mappa teamId -> name usando l’array passato (evita dipendere da setState async)
    const teamNameById = new Map(membershipTeams.map(t => [t.id, t.name]))
    const teamsByEvent = new Map<string, string[]>()
    for (const r of relations || []) {
      const name = teamNameById.get(r.team_id)
      if (!name) continue
      const arr = teamsByEvent.get(r.event_id) || []
      if (!arr.includes(name)) arr.push(name)
      teamsByEvent.set(r.event_id, arr)
    }

    const transformed: Event[] = (rows || []).map((ev: any) => ({
      id: ev.id,
      title: ev.title,
      description: ev.description,
      location: ev.location,
      start_time: ev.start_time,
      end_time: ev.end_time,
      is_recurring: ev.event_type === 'recurring',
      event_kind: ev.event_kind as EventKind | undefined,
      teams: teamsByEvent.get(ev.id) || []
    }))

    setEvents(transformed)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--cs-primary)' }} />
      </div>
    )
  }

  const calEvents: CalEvent[] = (filteredEvents||[]).map((e)=>({
    id: e.id,
    title: e.title,
    start: new Date(e.start_time),
    end: new Date(e.end_time),
    color: kindColor(e.event_kind)
  }))

  return (
    <>
      <div className="cs-card cs-card--primary">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">I Tuoi Eventi</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => exportEvents(filteredEvents, 'eventi_atleta_csroma')} className="cs-btn cs-btn--success">
              Esporta Excel
            </button>
            <button
              onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')}
              className={`cs-btn ${viewMode === 'list' ? 'cs-btn--outline' : 'cs-btn--accent'}`}
            >
              {viewMode === 'list' ? 'Vista Calendario' : 'Vista Elenco'}
            </button>
          </div>
        </div>

        {viewMode === 'calendar' ? (
          <SimpleCalendar
            currentDate={currentDate}
            view={calView}
            events={calEvents}
            onNavigate={(act) => {
              const d = new Date(currentDate)
              if (act === 'today') setCurrentDate(new Date())
              else if (act === 'prev') { calView === 'month' ? d.setMonth(d.getMonth() - 1) : d.setDate(d.getDate() - 7); setCurrentDate(new Date(d)) }
              else { calView === 'month' ? d.setMonth(d.getMonth() + 1) : d.setDate(d.getDate() + 7); setCurrentDate(new Date(d)) }
            }}
            onViewChange={(v) => setCalView(v)}
            onEventClick={(id) => {
              const ev = filteredEvents.find(e => e.id === id)
              if (ev) setSelectedEvent(ev)
            }}
          />
        ) : teamMemberships.length === 0 ? (
          <div className="cs-card text-center py-12">
            <p className="text-secondary mb-4">Non sei iscritto a nessuna squadra</p>
            <p className="text-sm text-secondary">Contatta l'amministratore per essere aggiunto a una squadra</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="cs-card text-center py-12">
            <p className="text-secondary mb-4">Nessun evento trovato</p>
          </div>
        ) : (
          <div className="cs-list">
            {filteredEvents.map((event) => (
              <div
                key={event.id}
                className="cs-list-item cursor-pointer"
                onClick={() => setSelectedEvent(event)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{event.title}</h3>
                    {event.description && <p className="text-secondary mt-1">{event.description}</p>}
                    <div className="mt-2 text-sm text-secondary space-y-1">
                      <div>
                        📅 {new Date(event.start_time).toLocaleDateString('it-IT')} dalle{' '}
                        {new Date(event.start_time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} alle{' '}
                        {new Date(event.end_time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {event.location && <div>📍 {event.location}</div>}
                      {event.is_recurring && <div>🔄 Evento ricorrente</div>}
                      {!!event.teams.length && <div>👥 Squadre: {event.teams.join(', ')}</div>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedEvent && (
        <EventDetails id={selectedEvent.id} onClose={() => setSelectedEvent(null)} />
      )}
    </>
  )
}

function EventDetails({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/athlete/events/detail?id=${id}`)
        const json = await res.json()
        if (res.ok) setData(json)
      } catch {}
    })()
  }, [id])

  return (
    <DetailsDrawer open title="Dettaglio Evento" onClose={onClose}>
      {!data ? (
        <div className="text-sm text-gray-600">Caricamento...</div>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="font-medium">{data.title}</div>
          <div>📅 {new Date(data.start_date).toLocaleString('it-IT')} - {new Date(data.end_date).toLocaleString('it-IT')}</div>
          {data.location && <div>📍 {data.location}</div>}
          {data.gym && <div>🏟️ {data.gym.name}{data.gym.city ? ` - ${data.gym.city}` : ''}</div>}
          {!!(data.teams?.length) && <div>👥 {data.teams.map((t: any) => t.name).join(', ')}</div>}
          {data.creator && <div>✍️ {data.creator.first_name} {data.creator.last_name}</div>}
          {data.description && <div className="text-gray-700 whitespace-pre-wrap">{data.description}</div>}
        </div>
      )}
    </DetailsDrawer>
  )
}
