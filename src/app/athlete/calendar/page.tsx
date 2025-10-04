'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import DetailsDrawer from '@/components/shared/DetailsDrawer'
import SimpleCalendar, { CalEvent } from '@/components/calendar/SimpleCalendar'
import { useAuth } from '@/hooks/useAuth'
import { exportEvents } from '@/lib/utils/excelExport'
import PageHeader from '@/components/shared/PageHeader'

interface Event {
  id: string
  title: string
  description?: string
  location?: string
  start_time: string
  end_time: string
  is_recurring: boolean
  teams: string[]
  event_kind?: 'training'|'match'|'meeting'|'other'
}
function kindColor(kind?: string) {
  switch (kind) {
    case 'training': return '#16a34a'
    case 'match': return '#dc2626'
    case 'meeting': return '#2563eb'
    default: return '#6b7280'
  }
}

export default function AthleteCalendarPage() {
  const { user } = useAuth()
  const [events, setEvents] = useState<Event[]>([])
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  // Read-only view; no advanced filters
  const [teamMemberships, setTeamMemberships] = useState<any[]>([])
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [viewMode, setViewMode] = useState<'list'|'calendar'>('list')
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [calView, setCalView] = useState<'month'|'week'>('month')
  const supabase = createClient()

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  useEffect(() => {
    setFilteredEvents(events)
  }, [events])

  const loadData = async () => {
    setLoading(true)
    try {
      const memberships = await loadTeamMemberships()
      const teamIds = (memberships || []).map((m: any) => m.team.id)
      await loadEvents(teamIds)
    } finally {
      setLoading(false)
    }
  }

  const loadTeamMemberships = async () => {
    // Query base without PostgREST embedding to avoid schema cache join errors
    const { data: memberships, error } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('profile_id', user?.id)

    if (error) {
      console.error('Error loading athlete team memberships:', error)
      setTeamMemberships([])
      return
    }

    const teamIds = [...new Set((memberships || []).map(m => m.team_id).filter(Boolean))]
    if (teamIds.length === 0) {
      setTeamMemberships([])
      return
    }

    const { data: teams, error: teamsErr } = await supabase
      .from('teams')
      .select('id, name, code')
      .in('id', teamIds)

    if (teamsErr) {
      console.error('Error loading teams for athlete:', teamsErr)
      setTeamMemberships([])
      return
    }

    const mapped = (teams || []).map(t => ({ team: t }))
    setTeamMemberships(mapped)
    return mapped
  }

  const loadEvents = async (teamIds: string[]) => {
    if (!teamIds || teamIds.length === 0) return

    // Step 1: fetch relations for athlete teams
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

    // Step 2: fetch events by IDs
    const { data: eventsData, error: evErr } = await supabase
      .from('events')
      .select('id, title, description, location, start_time:start_date, end_time:end_date, event_type, event_kind')
      .in('id', eventIds)
      .order('start_date', { ascending: true })

    if (evErr) {
      console.error('Error loading events for athlete:', evErr)
      setEvents([])
      return
    }

    // Map teams per event using athlete teams only (names)
    const teamMap = new Map(teamMemberships.map(tm => [tm.team.id, tm.team.name]))
    const teamsByEvent = new Map<string, string[]>()
    for (const r of relations || []) {
      const name = teamMap.get(r.team_id)
      if (!name) continue
      const arr = teamsByEvent.get(r.event_id) || []
      if (!arr.includes(name)) arr.push(name)
      teamsByEvent.set(r.event_id, arr)
    }

    const transformed = (eventsData || []).map(ev => ({
      id: ev.id,
      title: ev.title,
      description: ev.description,
      location: ev.location,
      start_time: ev.start_time,
      end_time: ev.end_time,
      is_recurring: ev.event_type === 'recurring',
      event_kind: (ev as any).event_kind,
      teams: teamsByEvent.get(ev.id) || []
    }))

    setEvents(transformed)
  }

  // No filter function needed

  const getEventStatusColor = (startTime: string) => {
    const now = new Date()
    const eventStart = new Date(startTime)
    const eventEnd = new Date(startTime)
    eventEnd.setHours(eventEnd.getHours() + 2) // Assume 2 hour duration

    if (eventEnd < now) {
      return 'border-gray-300 bg-gray-50' // Past
    } else if (eventStart <= now && now <= eventEnd) {
      return 'border-green-500 bg-green-50' // Ongoing
    } else {
      return 'border-blue-500 bg-blue-50' // Future
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <>
      <PageHeader title="Gestione Calendario" subtitle="Area Atleta" />
<div className="cs-card">
  <div className="flex justify-between items-center mb-6">
    <h2 className="text-xl font-semibold">I Tuoi Eventi</h2>
    <div className="flex items-center gap-2">
      <button
        onClick={() => exportEvents(filteredEvents, 'eventi_atleta_csroma')}
        className="cs-btn cs-btn--success"
      >
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
              events={(filteredEvents||[]).map((e:any)=>({ id: e.id, title: e.title, start: new Date(e.start_time), end: new Date(e.end_time), color: kindColor(e.event_kind) }))}
              onNavigate={(act)=>{
                const d = new Date(currentDate)
                if (act==='today') setCurrentDate(new Date())
                else if (act==='prev') { if (calView==='month') d.setMonth(d.getMonth()-1); else d.setDate(d.getDate()-7); setCurrentDate(new Date(d)) }
                else { if (calView==='month') d.setMonth(d.getMonth()+1); else d.setDate(d.getDate()+7); setCurrentDate(new Date(d)) }
              }}
              onViewChange={(v)=>setCalView(v)}
              onEventClick={(id)=>{ const ev = filteredEvents.find(e=>e.id===id); if (ev) setSelectedEvent(ev) }}
            />
          ) : teamMemberships.length === 0 ? (
            <div className="cs-card text-center py-12">
              <p className="text-gray-500 mb-4">Non sei iscritto a nessuna squadra</p>
              <p className="text-sm text-gray-400">Contatta l'amministratore per essere aggiunto a una squadra</p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="cs-card text-center py-12">
              <p className="text-gray-500 mb-4">Nessun evento trovato</p>
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

          {event.description && (
            <p className="text-secondary mt-1">{event.description}</p>
          )}

          <div className="mt-2 text-sm text-secondary space-y-1">
            <div>
              📅 {new Date(event.start_time).toLocaleDateString('it-IT')} dalle{' '}
              {new Date(event.start_time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} alle{' '}
              {new Date(event.end_time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            </div>

            {event.location && <div>📍 {event.location}</div>}

            {event.is_recurring && (
              <div>🔄 Evento ricorrente</div>
            )}

            {event.teams && event.teams.length > 0 && (
              <div>👥 Squadre: {event.teams.join(', ')}</div>
                        )}
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
    const run = async () => {
      try {
        const res = await fetch(`/api/athlete/events/detail?id=${id}`)
        const json = await res.json()
        if (res.ok) setData(json)
      } catch {}
    }
    run()
  }, [id])
  return (
    <DetailsDrawer open={true} title="Dettaglio Evento" onClose={onClose}>
      {!data ? (
        <div className="text-sm text-gray-600">Caricamento...</div>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="font-medium">{data.title}</div>
          <div>📅 {new Date(data.start_date).toLocaleString('it-IT')} - {new Date(data.end_date).toLocaleString('it-IT')}</div>
          {data.location && <div>📍 {data.location}</div>}
          {data.gym && <div>🏟️ {data.gym.name} {data.gym.city ? `- ${data.gym.city}` : ''}</div>}
          {data.teams?.length > 0 && (
            <div>👥 {data.teams.map((t: any) => t.name).join(', ')}</div>
          )}
          {data.creator && (
            <div>✍️ {data.creator.first_name} {data.creator.last_name}</div>
          )}
          {data.description && <div className="text-gray-700 whitespace-pre-wrap">{data.description}</div>}
        </div>
      )}
    </DetailsDrawer>
  )
}

// Drawer dettagli evento
// Rendered within component via state selectedEvent
