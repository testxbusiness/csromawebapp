// src/components/coach/CoachCalendarManager.tsx
'use client'

import { useState, useEffect } from 'react'
import DetailsDrawer from '@/components/shared/DetailsDrawer'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import SimpleCalendar, { CalEvent } from '@/components/calendar/SimpleCalendar'

interface Event {
  id?: string
  title: string
  description?: string
  location?: string
  start_time: string
  end_time: string
  is_recurring: boolean
  recurrence_pattern?: string
  selected_teams: string[]
  event_type?: 'one_time' | 'recurring'
  parent_event_id?: string | null
  created_by?: string
  event_kind?: 'training' | 'match' | 'meeting' | 'other'
}

interface Team { id: string; name: string; code: string }
interface Gym { id: string; name: string; city?: string }
interface Activity { id: string; name: string }

export default function CoachCalendarManager() {
  const { user } = useAuth()
  const supabase = createClient()

  const [events, setEvents] = useState<Event[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [gyms, setGyms] = useState<Gym[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [viewMode, setViewMode] = useState<'list'|'calendar'>('list')
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [calView, setCalView] = useState<'month'|'week'>('month')

  useEffect(() => {
    if (user) loadData()
  }, [user])

  const loadData = async () => {
    setLoading(true)
    const coachTeams = await loadCoachTeams()
    await loadGyms()
    await loadActivities()
    await loadEvents(coachTeams)
    setLoading(false)
  }

  const loadCoachTeams = async (): Promise<Team[]> => {
    const { data } = await supabase
      .from('team_coaches')
      .select('team_id, teams(id, name, code)')
      .eq('coach_id', user?.id)

    const list = (data || []).map((row) => row.teams).filter(Boolean) as Team[]
    const ordered = list.sort((a, b) => a.name.localeCompare(b.name))
    setTeams(ordered)
    return ordered
  }

  const loadGyms = async () => {
    const { data } = await supabase.from('gyms').select('id, name, city').order('name')
    setGyms(data || [])
  }

  const loadActivities = async () => {
    const { data } = await supabase.from('activities').select('id, name').order('name')
    setActivities(data || [])
  }

  const loadEvents = async (teamsArg?: Team[]) => {
    const teamList = teamsArg ?? teams
    if (teamList.length === 0) { setEvents([]); return }

    const teamIds = teamList.map(t => t.id)

    const { data: links, error: etErr } = await supabase
      .from('event_teams')
      .select('event_id, team_id')
      .in('team_id', teamIds)
    if (etErr || !links || links.length === 0) { setEvents([]); return }

    const eventIds = Array.from(new Set(links.map(l => l.event_id)))

    const { data: rows } = await supabase
      .from('events')
      .select('id, title, description, location, start_time:start_date, end_time:end_date, event_type, event_kind, parent_event_id, created_by')
      .in('id', eventIds)
      .order('start_date', { ascending: false })

    const transformed = (rows || []).map((e: any) => ({
      ...e,
      is_recurring: e.event_type === 'recurring',
      selected_teams: links.filter(l => l.event_id === e.id).map(l => l.team_id),
      event_kind: e.event_kind
    }))

    setEvents(transformed)
  }

  const saveEvent = async (eventData: Event) => {
    try {
      if (editingEvent?.id) {
        const { error: eventError } = await supabase
          .from('events')
          .update({
            title: eventData.title,
            description: eventData.description,
            location: eventData.location,
            start_date: eventData.start_time,
            end_date: eventData.end_time,
            event_kind: (eventData as any).event_kind || 'training',
            // Legacy columns required by DB schema
            name: eventData.title,
            start_time: eventData.start_time,
            end_time: eventData.end_time,
            kind: 'spot',
          })
          .eq('id', editingEvent.id)
        if (eventError) throw eventError

        await supabase.from('event_teams').delete().eq('event_id', editingEvent.id)
        if (eventData.selected_teams.length > 0) {
          const teamAssociations = eventData.selected_teams.map(teamId => ({ event_id: editingEvent.id!, team_id: teamId }))
          const { error: teamsError } = await supabase.from('event_teams').insert(teamAssociations)
          if (teamsError) throw teamsError
        }
      } else {
        const isRecurring = (document.querySelector('select[name="event_type"]') as HTMLSelectElement)?.value === 'recurring'
        if (isRecurring) {
          const freq = (document.querySelector('select[name="recurrence_frequency"]') as HTMLSelectElement)?.value as 'daily'|'weekly'|'monthly' || 'weekly'
          const intervalVal = Number((document.querySelector('input[name="recurrence_interval"]') as HTMLInputElement)?.value || '1')
          const untilStr = (document.querySelector('input[name="recurrence_end_date"]') as HTMLInputElement)?.value
          const until = untilStr ? new Date(untilStr) : new Date(eventData.start_time)
          const occurrences: { start_date: string; end_date: string }[] = []
          let curStart = new Date(eventData.start_time)
          let curEnd = new Date(eventData.end_time)
          const interval = Math.max(1, intervalVal || 1)
          while (curStart <= until) {
            occurrences.push({ start_date: curStart.toISOString(), end_date: curEnd.toISOString() })
            if (freq === 'daily') { curStart.setDate(curStart.getDate() + interval); curEnd.setDate(curEnd.getDate() + interval) }
            else if (freq === 'weekly') { curStart.setDate(curStart.getDate() + 7*interval); curEnd.setDate(curEnd.getDate() + 7*interval) }
            else { curStart.setMonth(curStart.getMonth() + interval); curEnd.setMonth(curEnd.getMonth() + interval) }
          }
          const rows = occurrences.map(o => ({
            title: eventData.title,
            description: eventData.description,
            location: eventData.location,
            start_date: o.start_date,
            end_date: o.end_date,
            event_type: 'recurring',
            event_kind: (eventData as any).event_kind || 'training',
            created_by: user?.id,
            // Legacy columns required by DB schema
            name: eventData.title,
            start_time: o.start_date,
            end_time: o.end_date,
            kind: 'spot',
          }))
          const { data: inserted, error: bulkErr } = await supabase.from('events').insert(rows).select('id')
          if (bulkErr) throw bulkErr
          const ids = (inserted || []).map(r => r.id)
          if (ids.length > 0) {
            const parentId = ids[0]
            await supabase.from('events').update({ parent_event_id: parentId }).in('id', ids)
          }
          if (ids.length && eventData.selected_teams.length) {
            const et = ids.flatMap(eid => eventData.selected_teams.map(teamId => ({ event_id: eid, team_id: teamId })))
            const { error: teamsError } = await supabase.from('event_teams').insert(et)
            if (teamsError) throw teamsError
          }
        } else {
          const { data: newEvent, error: eventError } = await supabase
            .from('events')
            .insert([{
              title: eventData.title,
              description: eventData.description,
              location: eventData.location,
              start_date: eventData.start_time,
              end_date: eventData.end_time,
              event_type: 'one_time',
              event_kind: (eventData as any).event_kind || 'training',
              created_by: user?.id,
              // Legacy columns required by DB schema
              name: eventData.title,
              start_time: eventData.start_time,
              end_time: eventData.end_time,
              kind: 'spot',
            }])
            .select()
            .single()
          if (eventError) throw eventError
          if (eventData.selected_teams.length > 0) {
            const teamAssociations = eventData.selected_teams.map(teamId => ({ event_id: newEvent.id, team_id: teamId }))
            const { error: teamsError } = await supabase.from('event_teams').insert(teamAssociations)
            if (teamsError) throw teamsError
          }
        }
      }

      setEditingEvent(null)
      setShowForm(false)
      loadEvents()
    } catch (error) {
      console.error('Error saving event:', error)
    }
  }

  const deleteEvent = async (id: string) => {
    const evt = events.find(e => e.id === id)
    let deleteSeries = false
    if (evt?.event_type === 'recurring' || evt?.parent_event_id) {
      const choice = window.confirm('Questo evento fa parte di una ricorrenza. OK = elimina tutta la serie, Annulla = solo questa occorrenza.')
      if (choice) deleteSeries = true
      else {
        const confirmSingle = window.confirm('Vuoi eliminare SOLO questa occorrenza?')
        if (!confirmSingle) return
        deleteSeries = false
      }
    } else {
      if (!window.confirm('Sei sicuro di voler eliminare questo evento?')) return
    }

    if (deleteSeries) {
      const seriesId = evt?.parent_event_id || evt?.id
      if (!seriesId) return
      const { data: seriesEvents } = await supabase
        .from('events')
        .select('id')
        .or(`id.eq.${seriesId},parent_event_id.eq.${seriesId}`)
      const ids = (seriesEvents || []).map(e => e.id)
      if (ids.length) {
        await supabase.from('event_teams').delete().in('event_id', ids)
        const { error } = await supabase.from('events').delete().in('id', ids)
        if (!error) loadEvents()
      }
    } else {
      const { error } = await supabase.from('events').delete().eq('id', id)
      if (!error) loadEvents()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--cs-primary)' }} />
      </div>
    )
  }

  return (
    <>
      <div className="cs-card cs-card--primary">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">I Tuoi Eventi</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setEditingEvent(null); setShowForm(true) }}
              className="cs-btn cs-btn--danger"
            >
              Nuovo Evento
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
          <CalendarBlock
            view={calView}
            events={events}
            currentDate={currentDate}
            onNavigate={(act) => {
              const d = new Date(currentDate)
              if (act === 'today') setCurrentDate(new Date())
              else if (act === 'prev') { calView === 'month' ? d.setMonth(d.getMonth() - 1) : d.setDate(d.getDate() - 7); setCurrentDate(new Date(d)) }
              else { calView === 'month' ? d.setMonth(d.getMonth() + 1) : d.setDate(d.getDate() + 7); setCurrentDate(new Date(d)) }
            }}
            onViewChange={(v) => setCalView(v)}
            onEventClick={(id) => {
              const ev = events.find(e => e.id === id)
              if (ev) setSelectedEvent(ev)
            }}
          />
        ) : teams.length === 0 ? (
          <div className="cs-card text-center py-12">
            <p className="text-secondary mb-4">Non hai squadre assegnate</p>
            <p className="text-sm text-secondary">Contatta l'amministratore per essere assegnato a una squadra</p>
          </div>
        ) : events.length === 0 ? (
          <div className="cs-card text-center py-12">
            <p className="text-secondary mb-4">Nessun evento creato</p>
            <button onClick={() => setShowForm(true)} className="cs-btn cs-btn--primary">
              Crea il tuo primo evento
            </button>
          </div>
        ) : (
          <div className="cs-list">
            {events.map((event) => (
              <div key={event.id} className="cs-list-item cursor-pointer" onClick={() => setSelectedEvent(event)}>
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
                      <div>
                        👥 Squadre: {event.selected_teams.map(teamId => teams.find(t => t.id === teamId)?.name).filter(Boolean).join(', ')}
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2 ml-4">
                    {event.created_by === user?.id && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingEvent(event); setShowForm(true) }}
                          className="cs-btn cs-btn--ghost cs-btn--sm"
                        >
                          Modifica
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteEvent(event.id!) }}
                          className="cs-btn cs-btn--danger cs-btn--sm"
                        >
                          Elimina
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal semplice “inline” */}
        {showForm && (
          <div className="cs-overlay" aria-hidden="false">
            <div className="cs-modal cs-modal--md" data-state="open">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const formData = new FormData(e.currentTarget)
                  const selectedTeams = Array.from(formData.getAll('teams')) as string[]
                  const gym_id = (formData.get('gym_id') as string) || ''
                  const activity_id = (formData.get('activity_id') as string) || ''

                  const eventData: Event = {
                    title: formData.get('title') as string,
                    description: (formData.get('description') as string) || '',
                    location: (formData.get('location') as string) || '',
                    start_time: formData.get('start_time') as string,
                    end_time: formData.get('end_time') as string,
                    is_recurring: false,
                    selected_teams: selectedTeams
                  }
                  ;(eventData as any).gym_id = gym_id || undefined
                  ;(eventData as any).activity_id = activity_id || undefined
                  ;(eventData as any).event_kind = (document.querySelector('select[name="event_kind"]') as HTMLSelectElement)?.value || 'training'
                  saveEvent(eventData)
                }}
              >
                <div className="mb-4">
                  <h3 className="cs-modal__title">{editingEvent ? 'Modifica Evento' : 'Nuovo Evento'}</h3>
                </div>

                <div>
                  <label className="cs-field__label">Titolo Evento *</label>
                  <input type="text" name="title" required placeholder="Es: Allenamento Under 15..." defaultValue={editingEvent?.title || ''} className="cs-input" />
                </div>

                <div className="mb-4">
                  <label className="cs-field__label">Descrizione</label>
                  <textarea name="description" rows={3} placeholder="Descrizione (opzionale)" defaultValue={editingEvent?.description || ''} className="cs-textarea" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="cs-field__label">Data/Ora Inizio *</label>
                    <input type="datetime-local" name="start_time" required defaultValue={editingEvent?.start_time ? new Date(editingEvent.start_time).toISOString().slice(0, 16) : ''} className="cs-select" />
                  </div>
                  <div>
                    <label className="cs-field__label">Data/Ora Fine *</label>
                    <input type="datetime-local" name="end_time" required defaultValue={editingEvent?.end_time ? new Date(editingEvent.end_time).toISOString().slice(0, 16) : ''} className="cs-select" />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="cs-field__label">Luogo</label>
                  <input type="text" name="location" placeholder="Indirizzo o luogo specifico" defaultValue={editingEvent?.location || ''} className="cs-input" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="cs-field__label">Palestra</label>
                    <select name="gym_id" className="cs-select">
                      <option value="">Seleziona una palestra</option>
                      {gyms.map(g => (<option key={g.id} value={g.id}>{g.name}{g.city ? ` - ${g.city}` : ''}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="cs-field__label">Attività</label>
                    <select name="activity_id" className="cs-select">
                      <option value="">Seleziona un'attività</option>
                      {activities.map(a => (<option key={a.id} value={a.id}>{a.name}</option>))}
                    </select>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="cs-field__label">Squadre Associate</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto cs-card p-3">
                    {teams.map((team) => (
                      <label key={team.id} className="flex items-center">
                        <input type="checkbox" name="teams" value={team.id} defaultChecked={editingEvent?.selected_teams.includes(team.id)} className="mr-2" />
                        {team.name} ({team.code})
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="cs-field__label">Tipo Evento</label>
                  <select name="event_type" defaultValue={editingEvent ? 'one_time' : 'one_time'} className="cs-select">
                    <option value="one_time">Evento Singolo</option>
                    <option value="recurring">Evento Ricorrente</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className="cs-field__label">Tipologia</label>
                  <select name="event_kind" defaultValue={(editingEvent as any)?.event_kind || 'training'} className="cs-select">
                    <option value="training">Allenamento</option>
                    <option value="match">Partita</option>
                    <option value="meeting">Riunione</option>
                    <option value="other">Altro</option>
                  </select>
                </div>

                {/* Opzioni ricorrenza (sempre visibili: puoi nasconderle via JS al bisogno) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="cs-field__label">Frequenza</label>
                    <select name="recurrence_frequency" defaultValue="weekly" className="cs-select">
                      <option value="daily">Giornaliera</option>
                      <option value="weekly">Settimanale</option>
                      <option value="monthly">Mensile</option>
                    </select>
                  </div>
                  <div>
                    <label className="cs-field__label">Intervallo</label>
                    <input type="number" name="recurrence_interval" min={1} defaultValue={1} className="cs-select" />
                  </div>
                  <div>
                    <label className="cs-field__label">Fine Ricorrenza</label>
                    <input type="datetime-local" name="recurrence_end_date" className="cs-select" />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { setShowForm(false); setEditingEvent(null) }} className="cs-btn cs-btn--outline">
                    Annulla
                  </button>
                  <button type="submit" className="cs-btn cs-btn--primary">
                    {editingEvent ? 'Aggiorna Evento' : 'Crea Evento'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {selectedEvent && (
        <EventDetails id={selectedEvent.id!} onClose={() => setSelectedEvent(null)} />
      )}
    </>
  )
}

function EventDetails({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null)
  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(`/api/coach/events/detail?id=${id}`)
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
          {data.teams?.length > 0 && (<div>👥 {data.teams.map((t: any) => t.name).join(', ')}</div>)}
          {data.creator && (<div>✍️ {data.creator.first_name} {data.creator.last_name}</div>)}
          {data.description && <div className="text-gray-700 whitespace-pre-wrap">{data.description}</div>}
        </div>
      )}
    </DetailsDrawer>
  )
}

function kindColor(kind?: string) {
  switch (kind) {
    case 'training': return '#16a34a'
    case 'match': return '#dc2626'
    case 'meeting': return '#2563eb'
    default: return '#6b7280'
  }
}

function CalendarBlock({
  events, currentDate, onNavigate, view, onViewChange, onEventClick
}:{
  events: any[]; currentDate: Date; onNavigate: (a:'prev'|'next'|'today')=>void; view: 'month'|'week'; onViewChange: (v:'month'|'week')=>void; onEventClick: (id:string)=>void
}) {
  const evs: CalEvent[] = (events||[]).map((e:any) => ({
    id: e.id,
    title: e.title,
    start: new Date(e.start_time),
    end: new Date(e.end_time),
    color: kindColor(e.event_kind)
  }))
  return (
    <SimpleCalendar
      currentDate={currentDate}
      view={view}
      events={evs}
      onNavigate={onNavigate}
      onViewChange={onViewChange}
      onEventClick={onEventClick}
    />
  )
}
