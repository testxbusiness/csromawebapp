// src/components/coach/CoachCalendarManager.tsx
'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import DetailsDrawer from '@/components/shared/DetailsDrawer'
import EventDetailModal from '@/components/shared/EventDetailModal'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import SimpleCalendar, { CalEvent } from '@/components/calendar/SimpleCalendar'
import FullCalendarWidget from '@/components/calendar/FullCalendarWidget'
import { EmptyState, LoadingState } from '@/components/ui'

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
  requires_confirmation?: boolean
  confirmation_deadline?: string | null
}

interface Team { id: string; name: string; code: string }
interface Gym { id: string; name: string; city?: string }
interface Activity { id: string; name: string }

export default function CoachCalendarManager() {
  const { account } = useAuth()
  const ownerProfileId = account?.ownerProfileId || null
  const supabase = useMemo(() => createClient(), [])

  const [events, setEvents] = useState<Event[]>([])
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [gyms, setGyms] = useState<Gym[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingSelects, setLoadingSelects] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [viewMode, setViewMode] = useState<'list'|'calendar'>('calendar')
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [calView, setCalView] = useState<'month'|'week'>('month')
  const [filterEventKind, setFilterEventKind] = useState<string>('')
  const [filterTeamId, setFilterTeamId] = useState<string>('')

  const fetchControllerRef = useRef<AbortController | null>(null)

  const loadData = useCallback(async (signal?: AbortSignal) => {
    if (!ownerProfileId) {
      setEvents([])
      setTeams([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/coach/calendar', {
        signal,
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) {
        console.error('Error loading coach calendar:', response.statusText)
        setEvents([])
        setTeams([])
        return
      }

      const result = await response.json() as {
        teams?: unknown
        events?: unknown
      }

      // Keep the page tolerant of Supabase/PostgREST returning a to-one
      // relation as either an object or a one-item array.
      const normalizedTeams = Array.isArray(result.teams)
        ? result.teams.flatMap((team: any) => Array.isArray(team) ? team : [team])
        : []
      const normalizedEvents = Array.isArray(result.events) ? result.events : []

      setTeams(normalizedTeams as Team[])
      setEvents(normalizedEvents as Event[])
    } catch (error: any) {
      if (error?.name === 'AbortError') return
      console.error('Error loading coach calendar:', error)
      setEvents([])
      setTeams([])
    } finally {
      setLoading(false)
    }
  }, [ownerProfileId])

  useEffect(() => {
    if (!ownerProfileId) {
      fetchControllerRef.current?.abort()
      fetchControllerRef.current = null
      setEvents([])
      setTeams([])
      setLoading(false)
      return
    }

    const controller = new AbortController()
    fetchControllerRef.current?.abort()
    fetchControllerRef.current = controller
    void loadData(controller.signal)

    return () => {
      controller.abort()
    }
  }, [ownerProfileId, loadData])

  useEffect(() => {
    let next = events
    if (filterEventKind) {
      next = next.filter(e => e.event_kind === filterEventKind)
    }
    if (filterTeamId) {
      next = next.filter(e => (e.selected_teams || []).includes(filterTeamId))
    }
    setFilteredEvents(next)
  }, [events, filterEventKind, filterTeamId])

  const filteredEventsForCalendar = useMemo(() => filteredEvents, [filteredEvents])

  const refreshEvents = useCallback(() => {
    void loadData()
  }, [loadData])

  // Lazy load gyms/activities solo quando il form si apre
  const loadSelectOptions = useCallback(async () => {
    setLoadingSelects(true)
    try {
      const [{ data: gymsData }, { data: activitiesData }] = await Promise.all([
        supabase.from('gyms').select('id, name, city').order('name'),
        supabase.from('activities').select('id, name').order('name')
      ])
      setGyms(gymsData || [])
      setActivities(activitiesData || [])
    } catch (error) {
      console.error('Errore caricamento select:', error)
    } finally {
      setLoadingSelects(false)
    }
  }, [supabase])

  useEffect(() => {
    if (showForm && gyms.length === 0 && activities.length === 0) {
      void loadSelectOptions()
    }
  }, [activities.length, gyms.length, loadSelectOptions, showForm])

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
            requires_confirmation: !!eventData.requires_confirmation,
            confirmation_deadline: eventData.requires_confirmation && eventData.confirmation_deadline
              ? eventData.confirmation_deadline
              : null,
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
            requires_confirmation: !!eventData.requires_confirmation,
            confirmation_deadline: eventData.requires_confirmation && eventData.confirmation_deadline
              ? eventData.confirmation_deadline
              : null,
            created_by: ownerProfileId,
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
              requires_confirmation: !!eventData.requires_confirmation,
              confirmation_deadline: eventData.requires_confirmation && eventData.confirmation_deadline
                ? eventData.confirmation_deadline
                : null,
              created_by: ownerProfileId,
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
      refreshEvents()
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
        if (!error) refreshEvents()
      }
    } else {
      const { error } = await supabase.from('events').delete().eq('id', id)
      if (!error) refreshEvents()
    }
  }

  if (loading) {
    return <LoadingState label="Caricamento calendario..." />
  }

  return (
    <>
      <div className="cs-card cs-card--primary">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <h2 className="text-xl font-semibold">I Tuoi Eventi</h2>
          <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row sm:items-center sm:justify-end">
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

        {/* Filtri */}
        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="cs-field__label">Tipo Evento</label>
            <select
              value={filterEventKind}
              onChange={(e) => setFilterEventKind(e.target.value)}
              className="cs-select"
            >
              <option value="">Tutti i tipi</option>
              <option value="training">Allenamento</option>
              <option value="match">Partita</option>
              <option value="meeting">Riunione</option>
              <option value="other">Altro</option>
            </select>
          </div>
          <div>
            <label className="cs-field__label">Squadra</label>
            <select
              value={filterTeamId}
              onChange={(e) => setFilterTeamId(e.target.value)}
              className="cs-select"
            >
              <option value="">Tutte le squadre</option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </div>
        </div>

        {viewMode === 'calendar' ? (
          <FullCalendarWidget
            initialDate={currentDate}
            view={calView}
            events={(filteredEventsForCalendar || []).map((e:any)=>({
              id: e.id!, title: e.title,
              start: new Date(e.start_time), end: new Date(e.end_time),
              color: (function(){
                switch (e.event_kind) {
                  case 'training': return '#16a34a'
                  case 'match': return '#dc2626'
                  case 'meeting': return '#2563eb'
                  default: return '#6b7280'
                }
              })()
            }))}
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
            onSelectSlot={(start, end) => {
              setEditingEvent({
                title: '', description: '',
                location: '',
                start_time: start.toISOString(),
                end_time: end.toISOString(),
                is_recurring: false,
                selected_teams: teams.map(t => t.id),
                event_type: 'one_time',
                event_kind: 'training'
              } as any)
              setShowForm(true)
            }}
          />
        ) : teams.length === 0 ? (
          <EmptyState title="Non hai squadre assegnate" description="Contatta l'amministratore per essere assegnato a una squadra" />
        ) : filteredEvents.length === 0 ? (
          <EmptyState
            title="Nessun evento trovato"
            action={events.length === 0 ? <button onClick={() => setShowForm(true)} className="cs-btn cs-btn--primary">Crea il tuo primo evento</button> : undefined}
          />
        ) : (
          <div className="overflow-hidden">
            {/* Desktop */}
            <div className="hidden md:block">
              <table className="cs-table">
                <thead>
                  <tr>
                    <th>Evento</th>
                    <th>Data/Ora</th>
                    <th>Luogo</th>
                    <th>Squadre</th>
                    <th>Tipo</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((event) => (
                    <tr key={event.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedEvent(event)}>
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium">{event.title}</div>
                          <div className="text-secondary text-sm">{event.description}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>{new Date(event.start_time).toLocaleDateString('it-IT')}</div>
                        <div className="text-xs text-secondary">
                          {new Date(event.start_time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} - {new Date(event.end_time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>{event.location || 'N/D'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div>{(event.selected_teams || []).map(teamId => teams.find(t => t.id === teamId)?.name).filter(Boolean).join(', ') || 'N/D'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`cs-badge ${
                          event.event_kind === 'training' ? 'cs-badge--primary' :
                          event.event_kind === 'match' ? 'cs-badge--danger' :
                          event.event_kind === 'meeting' ? 'cs-badge--accent' :
                          'cs-badge--neutral'
                        }`}>
                          {event.event_kind === 'training' ? 'Allenamento' :
                           event.event_kind === 'match' ? 'Partita' :
                           event.event_kind === 'meeting' ? 'Riunione' :
                           event.event_kind === 'other' ? 'Altro' : 'N/D'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium cs-table__actions">
                        <button onClick={(e) => { e.stopPropagation(); setEditingEvent(event); setShowForm(true) }} className="cs-btn cs-btn--outline cs-btn--sm">Modifica</button>
                        <button onClick={(e) => { e.stopPropagation(); deleteEvent(event.id!) }} className="cs-btn cs-btn--danger cs-btn--sm">Elimina</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden p-4 space-y-3">
              {filteredEvents.map((event) => (
                <div key={event.id} className="cs-card" onClick={() => setSelectedEvent(event)}>
                  <div className="font-semibold">{event.title}</div>
                  {event.description && (
                    <div className="text-sm text-secondary line-clamp-3">{event.description}</div>
                  )}
                  <div className="mt-2 grid gap-2 text-sm">
                    <div>
                      <strong>Data:</strong> {new Date(event.start_time).toLocaleDateString('it-IT')}
                      <span className="text-secondary ml-2">
                        {new Date(event.start_time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                        {' - '}
                        {new Date(event.end_time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div><strong>Luogo:</strong> {event.location || 'N/D'}</div>
                    <div><strong>Squadre:</strong> {(event.selected_teams || []).map(teamId => teams.find(t => t.id === teamId)?.name).filter(Boolean).join(', ') || 'N/D'}</div>
                    <div>
                      <strong>Tipo:</strong>
                      <span className={`ml-2 cs-badge ${
                        event.event_kind === 'training' ? 'cs-badge--primary' :
                        event.event_kind === 'match' ? 'cs-badge--danger' :
                        event.event_kind === 'meeting' ? 'cs-badge--accent' :
                        'cs-badge--neutral'
                      }`}>
                        {event.event_kind === 'training' ? 'Allenamento' :
                         event.event_kind === 'match' ? 'Partita' :
                         event.event_kind === 'meeting' ? 'Riunione' :
                         event.event_kind === 'other' ? 'Altro' : 'N/D'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); setEditingEvent(event); setShowForm(true) }} className="cs-btn cs-btn--outline cs-btn--sm flex-1">Modifica</button>
                    <button onClick={(e) => { e.stopPropagation(); deleteEvent(event.id!) }} className="cs-btn cs-btn--danger cs-btn--sm flex-1">Elimina</button>
                  </div>
                </div>
              ))}
            </div>
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
                  const requiresConfirmation = formData.get('requires_confirmation') === 'on'
                  const confirmationDeadline = (formData.get('confirmation_deadline') as string) || null

                  const eventData: Event = {
                    title: formData.get('title') as string,
                    description: (formData.get('description') as string) || '',
                    location: (formData.get('location') as string) || '',
                    start_time: formData.get('start_time') as string,
                    end_time: formData.get('end_time') as string,
                    is_recurring: false,
                    selected_teams: selectedTeams,
                    requires_confirmation: requiresConfirmation,
                    confirmation_deadline: confirmationDeadline
                      ? new Date(confirmationDeadline).toISOString()
                      : null,
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
                    <select name="gym_id" className="cs-select" disabled={loadingSelects}>
                      <option value="">
                        {loadingSelects ? 'Caricamento...' : 'Seleziona una palestra'}
                      </option>
                      {gyms.map(g => (<option key={g.id} value={g.id}>{g.name}{g.city ? ` - ${g.city}` : ''}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="cs-field__label">Attività</label>
                    <select name="activity_id" className="cs-select" disabled={loadingSelects}>
                      <option value="">
                        {loadingSelects ? 'Caricamento...' : 'Seleziona un\'attività'}
                      </option>
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

                <div className="mb-4 cs-card p-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="requires_confirmation"
                      defaultChecked={editingEvent?.requires_confirmation ?? false}
                    />
                    <span className="text-sm font-medium">Richiedi conferma partecipazione (RSVP)</span>
                  </label>
                  <label className="mt-3 block">
                    <span className="cs-field__label">Scadenza conferma (opzionale)</span>
                    <input
                      type="datetime-local"
                      name="confirmation_deadline"
                      defaultValue={editingEvent?.confirmation_deadline
                        ? new Date(editingEvent.confirmation_deadline).toISOString().slice(0, 16)
                        : ''}
                      className="cs-select"
                    />
                  </label>
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
    <EventDetailModal open={true} onClose={onClose} data={data}>
      {data?.requires_confirmation && <CoachEventAttendancePanel eventId={id} />}
    </EventDetailModal>
  )
}

type AttendanceProfile = {
  id: string
  first_name: string
  last_name: string
  email?: string | null
}

type AttendanceEntry = {
  profile_id: string
  status: 'going' | 'maybe' | 'declined'
  responded_at: string | null
  profiles: AttendanceProfile | null
}

type AttendanceReport = {
  going: AttendanceEntry[]
  maybe: AttendanceEntry[]
  declined: AttendanceEntry[]
  no_response: AttendanceProfile[]
  counts: {
    going: number
    maybe: number
    declined: number
    no_response: number
  }
}

const emptyAttendanceReport: AttendanceReport = {
  going: [],
  maybe: [],
  declined: [],
  no_response: [],
  counts: { going: 0, maybe: 0, declined: 0, no_response: 0 },
}

function CoachEventAttendancePanel({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<AttendanceReport>(emptyAttendanceReport)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    fetch(`/api/coach/events/attendance?event_id=${eventId}`, { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json() as Partial<AttendanceReport> & { error?: string }
        if (!response.ok) throw new Error(result.error || 'Errore caricamento conferme')
        if (active) {
          setReport({
            going: result.going ?? [],
            maybe: result.maybe ?? [],
            declined: result.declined ?? [],
            no_response: result.no_response ?? [],
            counts: result.counts ?? emptyAttendanceReport.counts,
          })
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Errore caricamento conferme')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [eventId])

  if (loading) return <div className="mt-4 border-t border-[color:var(--cs-border)] pt-4 text-xs text-secondary">Caricamento conferme…</div>
  if (error) return <div className="mt-4 border-t border-[color:var(--cs-border)] pt-4 text-xs text-secondary">{error}</div>

  const names = (entry: AttendanceEntry | AttendanceProfile) => {
    const profile = 'profiles' in entry ? entry.profiles : entry
    return profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Profilo non disponibile'
  }
  const renderNames = (entries: Array<AttendanceEntry | AttendanceProfile>) => (
    entries.length > 0
      ? entries.map((entry) => (
        <div key={'profile_id' in entry ? `attendance-${entry.profile_id}` : `profile-${entry.id}`}>
          {names(entry)}
        </div>
      ))
      : <div className="text-secondary">Nessun atleta</div>
  )

  return (
    <div className="mt-4 border-t border-[color:var(--cs-border)] pt-4" aria-label="Report conferme partecipazione">
      <div className="text-sm font-semibold mb-3">Report conferme partecipazione</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="cs-card cs-card--primary p-3">
          <div className="text-sm font-semibold mb-1">Confermati ({report.counts.going})</div>
          <div className="max-h-40 space-y-1 overflow-y-auto text-sm">{renderNames(report.going)}</div>
        </div>
        <div className="cs-card cs-card--primary p-3">
          <div className="text-sm font-semibold mb-1">Forse ({report.counts.maybe})</div>
          <div className="max-h-40 space-y-1 overflow-y-auto text-sm">{renderNames(report.maybe)}</div>
        </div>
        <div className="cs-card cs-card--primary p-3">
          <div className="text-sm font-semibold mb-1">Non partecipano ({report.counts.declined})</div>
          <div className="max-h-40 space-y-1 overflow-y-auto text-sm">{renderNames(report.declined)}</div>
        </div>
        <div className="cs-card cs-card--primary p-3">
          <div className="text-sm font-semibold mb-1">Nessuna risposta ({report.counts.no_response})</div>
          <div className="max-h-40 space-y-1 overflow-y-auto text-sm">{renderNames(report.no_response)}</div>
        </div>
      </div>
    </div>
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
