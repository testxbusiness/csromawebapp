'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { exportToExcel } from '@/lib/utils/excelExport'
import SimpleCalendar, { CalEvent } from '@/components/calendar/SimpleCalendar'
import FullCalendarWidget from '@/components/calendar/FullCalendarWidget'
import { toast } from '@/components/ui'
import DetailsDrawer from '@/components/shared/DetailsDrawer'
import EventDetailModal from '@/components/shared/EventDetailModal'
import EventModal from '@/components/admin/EventModal'

const KIND_COLORS: Record<'training'|'match'|'meeting'|'other', string> = {
  training: '#413c67', // Allenamento (blu CSRoma)
  match:    '#d71920', // Partita (rosso CSRoma)
  meeting:  '#f5eb00', // Riunione (giallo CSRoma)
  other:    '#6b7280', // Altro (grigio)
}

const EVENT_KIND_OPTIONS = [
  { value: 'training', label: 'Allenamento' },
  { value: 'match', label: 'Partita' },
  { value: 'meeting', label: 'Riunione' },
  { value: 'other', label: 'Altro' },
] as const

interface Event {
  id?: string
  title: string
  description?: string
  start_date: string
  end_date: string
  location?: string
  gym_id?: string
  activity_id?: string
  event_type: 'one_time' | 'recurring'
  event_kind?: 'training'|'match'|'meeting'|'other'
  recurrence_rule?: { frequency: 'daily'|'weekly'|'monthly', interval?: number }
  recurrence_end_date?: string
  parent_event_id?: string
  created_by?: string
  created_at?: string
  updated_at?: string
  
  // Joined data
  gyms?: {
    name: string
    address: string
    city: string
  }
  activities?: {
    name: string
  }
  event_teams?: {
    teams: {
      id: string
      name: string
    }
  }[]
  created_by_profile?: {
    first_name: string
    last_name: string
  }
}

interface Gym {
  id: string
  name: string
  address: string
  city: string
}

interface Activity {
  id: string
  name: string
}

interface Team {
  id: string
  name: string
  code: string
}

export default function EventsManager() {
  const [events, setEvents] = useState<Event[]>([])
  const [gyms, setGyms] = useState<Gym[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [filterTeams, setFilterTeams] = useState<string[]>([])
  const [isTeamDropdownOpen, setIsTeamDropdownOpen] = useState(false)
  const [filterEventKinds, setFilterEventKinds] = useState<string[]>([])
  const [isEventKindDropdownOpen, setIsEventKindDropdownOpen] = useState(false)
  const [filterFrom, setFilterFrom] = useState<string>('')
  const [filterTo, setFilterTo] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [loadingSelects, setLoadingSelects] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [viewMode, setViewMode] = useState<'list'|'calendar'>('calendar')
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [calView, setCalView] = useState<'month'|'week'>('month')
  const teamDropdownRef = useRef<HTMLDivElement | null>(null)
  const eventKindDropdownRef = useRef<HTMLDivElement | null>(null)
  const supabase = createClient()

  const selectedTeamsLabel = (() => {
    if (filterTeams.length === 0) return 'Tutte le squadre'
    if (filterTeams.length === 1) {
      const team = teams.find((t) => t.id === filterTeams[0])
      return team ? `${team.name} (${team.code})` : '1 squadra selezionata'
    }
    return `${filterTeams.length} squadre selezionate`
  })()

  const selectedEventKindsLabel = (() => {
    if (filterEventKinds.length === 0) return 'Tutti i tipi'
    if (filterEventKinds.length === 1) {
      const item = EVENT_KIND_OPTIONS.find((option) => option.value === filterEventKinds[0])
      return item?.label || '1 tipo selezionato'
    }
    return `${filterEventKinds.length} tipi selezionati`
  })()

  useEffect(() => {
    loadEvents()
    loadTeams()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Lazy load gyms/activities solo quando il modal si apre
  useEffect(() => {
    if (showModal && gyms.length === 0 && activities.length === 0) {
      loadSelectOptions()
    }
  }, [showModal])

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (teamDropdownRef.current && !teamDropdownRef.current.contains(event.target as Node)) {
        setIsTeamDropdownOpen(false)
      }
      if (eventKindDropdownRef.current && !eventKindDropdownRef.current.contains(event.target as Node)) {
        setIsEventKindDropdownOpen(false)
      }
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsTeamDropdownOpen(false)
        setIsEventKindDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onEscape)
    }
  }, [])

  const loadEvents = async (overrides?: {
    teamIds?: string[]
    eventKinds?: string[]
    from?: string
    to?: string
  }) => {
    setLoading(true)
    try {
      const selectedTeamIds = overrides?.teamIds ?? filterTeams
      const selectedEventKinds = overrides?.eventKinds ?? filterEventKinds
      const selectedFrom = overrides?.from ?? filterFrom
      const selectedTo = overrides?.to ?? filterTo

      const params = new URLSearchParams()
      if (selectedTeamIds.length > 0) params.set('team_ids', selectedTeamIds.join(','))
      if (selectedFrom) params.set('from', new Date(selectedFrom).toISOString())
      if (selectedTo) params.set('to', new Date(selectedTo).toISOString())
      params.set('limit', '5000')
      const qs = params.toString()
      const response = await fetch(`/api/admin/events${qs ? `?${qs}` : ''}`)
      const result = await response.json()

      if (!response.ok) {
        console.error('Errore caricamento eventi:', result.error)
        setEvents([])
        setLoading(false)
        return
      }

      console.log('Eventi caricati:', result.events)
      // Assicurati che i dati correlati siano sempre oggetti validi
      let eventsWithSafeData = (result.events || []).map(event => ({
        ...event,
        gyms: event.gyms || null,
        activities: event.activities || null,
        event_teams: event.event_teams || [],
        created_by_profile: event.created_by_profile || null
      }))

      // Filtro locale per event_kind
      if (selectedEventKinds.length > 0) {
        eventsWithSafeData = eventsWithSafeData.filter(
          (e) => !!e.event_kind && selectedEventKinds.includes(e.event_kind)
        )
      }

      setEvents(eventsWithSafeData)
      setLoading(false)
    } catch (error) {
      console.error('Errore caricamento eventi:', error)
      setEvents([])
      setLoading(false)
    }
  }

  const loadSelectOptions = async () => {
    setLoadingSelects(true)
    try {
      const [{ data: gymsData }, { data: activitiesData }] = await Promise.all([
        supabase.from('gyms').select('id, name, address, city').order('name'),
        supabase.from('activities').select('id, name').order('name')
      ])
      setGyms(gymsData || [])
      setActivities(activitiesData || [])
    } catch (error) {
      console.error('Errore caricamento select:', error)
    } finally {
      setLoadingSelects(false)
    }
  }

  const loadTeams = async () => {
    const { data } = await supabase
      .from('teams')
      .select('id, name, code')
      .order('name')

    setTeams(data || [])
  }

  const toggleTeamFilter = (teamId: string) => {
    setFilterTeams((prev) => (
      prev.includes(teamId)
        ? prev.filter((id) => id !== teamId)
        : [...prev, teamId]
    ))
  }

  const selectAllTeams = () => {
    setFilterTeams(teams.map((t) => t.id))
  }

  const toggleEventKindFilter = (kind: string) => {
    setFilterEventKinds((prev) => (
      prev.includes(kind)
        ? prev.filter((value) => value !== kind)
        : [...prev, kind]
    ))
  }

  const selectAllEventKinds = () => {
    setFilterEventKinds(EVENT_KIND_OPTIONS.map((option) => option.value))
  }

  const handleCreateEvent = async (eventData: Omit<Event, 'id'>) => {
    try {
      const response = await fetch('/api/admin/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData)
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('Errore creazione evento:', result.error)
        toast.error(`Errore: ${result.error || 'Impossibile creare l\'evento'}`)
        return
      }

      toast.success('Evento creato con successo')
      setShowModal(false)
      setEditingEvent(null)
      loadEvents()

    } catch (error) {
      console.error('Errore creazione evento:', error)
      toast.error('Errore di rete durante la creazione dell\'evento')
    }
  }

  const handleUpdateEvent = async (id: string, eventData: Partial<Event>) => {
    try {
      const response = await fetch('/api/admin/events', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          ...eventData
        })
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('Errore aggiornamento evento:', result.error)
        toast.error(`Errore: ${result.error || 'Aggiornamento non riuscito'}`)
        return
      }

      toast.success('Evento aggiornato con successo')
      setShowModal(false)
      setEditingEvent(null)
      loadEvents()

    } catch (error) {
      console.error('Errore aggiornamento evento:', error)
      toast.error('Errore di rete durante l\'aggiornamento dell\'evento')
    }
  }

  const handleDeleteEvent = async (id: string) => {
    const evt = events.find(e => e.id === id)
    let scope: 'one' | 'series' = 'one'
    if (evt?.event_type === 'recurring' || (evt as any)?.parent_event_id) {
      const deleteSeries = window.confirm('Questo evento fa parte di una ricorrenza. Premi OK per eliminare TUTTA la serie, oppure Annulla per scegliere di eliminare solo questa occorrenza.')
      if (deleteSeries) {
        scope = 'series'
      } else {
        const confirmSingle = window.confirm('Vuoi eliminare SOLO questa occorrenza?')
        if (!confirmSingle) return
        scope = 'one'
      }
    } else {
      if (!window.confirm('Sei sicuro di voler eliminare questo evento?')) return
    }
      try {
        const response = await fetch(`/api/admin/events?id=${id}&scope=${scope}`, {
          method: 'DELETE',
        })

        const result = await response.json()

        if (!response.ok) {
          console.error('Errore eliminazione evento:', result.error)
          toast.error(`Errore: ${result.error || 'Eliminazione non riuscita'}`)
          return
        }

        toast.success('Evento eliminato con successo')
        loadEvents()

      } catch (error) {
        console.error('Errore eliminazione evento:', error)
        toast.error('Errore di rete durante l\'eliminazione dell\'evento')
      }
    
  }

  const exportEventsToExcel = () => {
    exportToExcel(events, [
      { key: 'title', title: 'Titolo Evento', width: 25 },
      { key: 'description', title: 'Descrizione', width: 30 },
      { key: 'start_date', title: 'Data Inizio', width: 15, format: (val) => new Date(val).toLocaleString('it-IT') },
      { key: 'end_date', title: 'Data Fine', width: 15, format: (val) => new Date(val).toLocaleString('it-IT') },
      { key: 'location', title: 'Luogo', width: 20 },
      { key: 'gyms', title: 'Palestra', width: 15, format: (val) => val?.name || '' },
      { key: 'event_teams', title: 'Squadre', width: 25, format: (val) => Array.isArray(val) ? val.map((et: any) => et.teams?.name).filter(Boolean).join(', ') : '' },
      { key: 'event_type', title: 'Tipo Evento', width: 12, format: (val) => val === 'one_time' ? 'Singolo' : 'Ricorrente' },
      { key: 'event_kind', title: 'Tipologia', width: 12, format: (val) => ({training:'Allenamento', match:'Partita', meeting:'Riunione', other:'Altro'} as any)[val] || '' },
      { key: 'created_by_profile', title: 'Creato Da', width: 20, format: (val) => val ? `${val.first_name} ${val.last_name}` : '' }
    ], {
      filename: 'eventi_csroma',
      sheetName: 'Eventi',
      headerStyle: { fill: { fgColor: { rgb: '3498DB' } } }
    })
  }

  if (loading) {
    return <div className="p-4">Caricamento eventi...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-bold">Calendario e Eventi</h2>
        <div className="flex flex-col gap-2 w-full md:w-auto md:flex-row md:flex-wrap md:gap-3">
          <button onClick={exportEventsToExcel} className="cs-btn cs-btn--outline">
            <span className="mr-2">📊</span>
            Export Excel
          </button>
          <button onClick={() => { setEditingEvent(null); setShowModal(true) }} className="cs-btn cs-btn--primary">
            Nuovo Evento
          </button>
          <button onClick={() => setViewMode(viewMode==='list'?'calendar':'list')} className="cs-btn cs-btn--ghost">
            {viewMode === 'list' ? 'Vista Calendario' : 'Vista Elenco'}
          </button>
        </div>
      </div>

      {/* Filtri */}
      <div className="cs-card cs-card--primary p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="cs-field__label">Squadra</label>
            <div className="relative" ref={teamDropdownRef}>
              <button
                type="button"
                onClick={() => setIsTeamDropdownOpen((prev) => !prev)}
                className="cs-input w-full flex items-center justify-between text-left min-h-[44px]"
                aria-haspopup="listbox"
                aria-expanded={isTeamDropdownOpen}
              >
                <span className="truncate">{selectedTeamsLabel}</span>
                <svg
                  className={`h-4 w-4 transition-transform ${isTeamDropdownOpen ? 'rotate-180' : ''}`}
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {isTeamDropdownOpen && (
                <div className="absolute z-20 mt-2 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                  <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-gray-100">
                    <button
                      type="button"
                      className="text-xs font-medium text-primary hover:underline min-h-[32px]"
                      onClick={selectAllTeams}
                    >
                      Seleziona tutte
                    </button>
                    <button
                      type="button"
                      className="text-xs font-medium text-secondary hover:underline min-h-[32px]"
                      onClick={() => setFilterTeams([])}
                    >
                      Svuota
                    </button>
                  </div>
                  <div className="max-h-56 overflow-auto p-2" role="listbox" aria-multiselectable="true">
                    {teams.length > 0 ? teams.map((t) => {
                      const checked = filterTeams.includes(t.id)
                      return (
                        <label
                          key={t.id}
                          className="flex items-center gap-3 rounded-md px-2 py-2 cursor-pointer hover:bg-gray-50 min-h-[44px]"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTeamFilter(t.id)}
                            className="h-4 w-4"
                          />
                          <span className="text-sm">{t.name} ({t.code})</span>
                        </label>
                      )
                    }) : (
                      <p className="px-2 py-2 text-sm text-secondary">Nessuna squadra disponibile</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="cs-field__label">Tipo Evento</label>
            <div className="relative" ref={eventKindDropdownRef}>
              <button
                type="button"
                onClick={() => setIsEventKindDropdownOpen((prev) => !prev)}
                className="cs-input w-full flex items-center justify-between text-left min-h-[44px]"
                aria-haspopup="listbox"
                aria-expanded={isEventKindDropdownOpen}
              >
                <span className="truncate">{selectedEventKindsLabel}</span>
                <svg
                  className={`h-4 w-4 transition-transform ${isEventKindDropdownOpen ? 'rotate-180' : ''}`}
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {isEventKindDropdownOpen && (
                <div className="absolute z-20 mt-2 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                  <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-gray-100">
                    <button
                      type="button"
                      className="text-xs font-medium text-primary hover:underline min-h-[32px]"
                      onClick={selectAllEventKinds}
                    >
                      Seleziona tutte
                    </button>
                    <button
                      type="button"
                      className="text-xs font-medium text-secondary hover:underline min-h-[32px]"
                      onClick={() => setFilterEventKinds([])}
                    >
                      Svuota
                    </button>
                  </div>
                  <div className="max-h-56 overflow-auto p-2" role="listbox" aria-multiselectable="true">
                    {EVENT_KIND_OPTIONS.map((option) => {
                      const checked = filterEventKinds.includes(option.value)
                      return (
                        <label
                          key={option.value}
                          className="flex items-center gap-3 rounded-md px-2 py-2 cursor-pointer hover:bg-gray-50 min-h-[44px]"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleEventKindFilter(option.value)}
                            className="h-4 w-4"
                          />
                          <span className="text-sm">{option.label}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="cs-field__label">Dal</label>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="cs-input"
            />
          </div>
          <div>
            <label className="cs-field__label">Al</label>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="cs-input"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => loadEvents()} className="cs-btn cs-btn--primary">Applica filtri</button>
            <button
              onClick={() => {
                setFilterTeams([])
                setFilterEventKinds([])
                setFilterFrom('')
                setFilterTo('')
                loadEvents({ teamIds: [], eventKinds: [], from: '', to: '' })
              }}
              className="cs-btn cs-btn--ghost"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <EventModal
  open={showModal}
  onClose={() => { setShowModal(false); setEditingEvent(null) }}
  event={editingEvent as any}
  gyms={gyms}
  activities={activities}
  teams={teams}
  onCreate={handleCreateEvent}
  onUpdate={handleUpdateEvent}
/>


      {viewMode === 'calendar' ? (
        <FullCalendarWidget
          initialDate={currentDate}
          view={calView}
          events={(events||[]).map((e:any)=>({
            id: e.id!,
            title: e.title,
            start: new Date(e.start_date),
            end: new Date(e.end_date),
            color: KIND_COLORS[(e.event_kind ?? 'other') as 'training'|'match'|'meeting'|'other'],
          }))}
          onNavigate={(act)=>{
            const d = new Date(currentDate)
            if (act==='today') setCurrentDate(new Date())
            else if (act==='prev') { if (calView==='month') d.setMonth(d.getMonth()-1); else d.setDate(d.getDate()-7); setCurrentDate(new Date(d)) }
            else { if (calView==='month') d.setMonth(d.getMonth()+1); else d.setDate(d.getDate()+7); setCurrentDate(new Date(d)) }
          }}
          onViewChange={(v)=>setCalView(v)}
          onEventClick={(id)=>{ const ev = events.find(e=>e.id===id); if (ev) setSelectedEvent(ev) }}
          onSelectSlot={(start, end)=>{
            setEditingEvent({
              title: '',
              description: '',
              start_date: start.toISOString(),
              end_date: end.toISOString(),
              location: '',
              gym_id: '',
              activity_id: '',
              event_type: 'one_time',
              event_kind: 'training',
              recurrence_rule: { frequency: 'weekly', interval: 1 },
              recurrence_end_date: '',
              selected_teams: [] as any,
            } as any)
            setShowModal(true)
          }}
        />
      ) : (
      <div className="cs-card cs-card--primary overflow-hidden">
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
            {events.map((event) => (
              <tr key={event.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedEvent(event)}>
                <td className="px-6 py-4">
                  <div>
                    <div className="font-medium">{event.title}</div>
                    <div className="text-secondary text-sm">{event.description}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    {new Date(event.start_date).toLocaleDateString('it-IT')}
                  </div>
                  <div className="text-xs text-secondary">
                    {new Date(event.start_date).toLocaleTimeString('it-IT', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })} - {new Date(event.end_date).toLocaleTimeString('it-IT', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div>
                    {event.location || (event.gyms && `${event.gyms.name}, ${event.gyms.city}`) || 'N/D'}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div>
                    {(event.event_teams || []).map(et => et.teams?.name).filter(Boolean).join(', ') || 'N/D'}
                  </div>
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
                  <button onClick={(e) => { e.stopPropagation(); setEditingEvent(event); setShowModal(true) }} className="cs-btn cs-btn--outline cs-btn--sm">Modifica</button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id!) }} className="cs-btn cs-btn--danger cs-btn--sm">Elimina</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden p-4 space-y-3">
          {events.map((event) => (
            <div key={event.id} className="cs-card" onClick={() => setSelectedEvent(event)}>
              <div className="font-semibold">{event.title}</div>
              {event.description && (
                <div className="text-sm text-secondary line-clamp-3">{event.description}</div>
              )}
              <div className="mt-2 grid gap-2 text-sm">
                <div>
                  <strong>Data:</strong> {new Date(event.start_date).toLocaleDateString('it-IT')}
                  <span className="text-secondary ml-2">
                    {new Date(event.start_date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                    {' - '}
                    {new Date(event.end_date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div><strong>Luogo:</strong> {event.location || (event.gyms && `${event.gyms.name}, ${event.gyms.city}`) || 'N/D'}</div>
                <div><strong>Squadre:</strong> {(event.event_teams || []).map(et => et.teams?.name).filter(Boolean).join(', ') || 'N/D'}</div>
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
                <button onClick={(e) => { e.stopPropagation(); setEditingEvent(event); setShowModal(true) }} className="cs-btn cs-btn--outline cs-btn--sm flex-1">Modifica</button>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id!) }} className="cs-btn cs-btn--danger cs-btn--sm flex-1">Elimina</button>
              </div>
            </div>
          ))}
          {events.length === 0 && (
            <div className="px-6 py-8 text-center">
              <div className="text-secondary mb-4"><span className="text-4xl">📅</span></div>
              <h3 className="text-lg font-semibold mb-2">Nessun evento creato</h3>
              <p className="text-secondary mb-4">Crea il tuo primo evento per iniziare a organizzare il calendario delle attività.</p>
              <button onClick={() => { setEditingEvent(null); setShowModal(true) }} className="cs-btn cs-btn--primary">Crea il tuo primo evento</button>
            </div>
          )}
        </div>
      </div>
      )}

      {selectedEvent && (
        <EventDetailModal
          open={true}
          onClose={() => setSelectedEvent(null)}
          data={{
            title: selectedEvent.title,
            event_kind: (selectedEvent as any).event_kind,
            start_date: selectedEvent.start_date,
            end_date: selectedEvent.end_date,
            location: selectedEvent.location,
            gym: selectedEvent.gyms ? { name: selectedEvent.gyms.name, city: (selectedEvent.gyms as any).city } : null,
            teams: (selectedEvent.event_teams || []).map(et => ({ name: et.teams?.name || '' })).filter(t => !!t.name),
            creator: selectedEvent.created_by_profile ? { first_name: selectedEvent.created_by_profile.first_name, last_name: selectedEvent.created_by_profile.last_name } : null,
            description: selectedEvent.description || ''
          }}
        />
      )}
    </div>
  )
}

function EventAttendancePanel({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(true)
  const [lists, setLists] = useState<any>({ going: [], maybe: [], declined: [], no_response: [], counts: { going: 0, maybe: 0, declined: 0, no_response: 0 } })
  useEffect(() => { (async () => {
    try {
      const res = await fetch(`/api/admin/events/attendance?event_id=${eventId}`)
      const j = await res.json()
      if (res.ok) setLists(j)
    } finally { setLoading(false) }
  })() }, [eventId])

  if (loading) return <div className="text-xs text-secondary mt-2">Caricamento conferme…</div>
  return (
    <div className="mt-3">
      <div className="text-xs text-secondary mb-1">RSVP</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="cs-card cs-card--primary p-3">
          <div className="text-sm font-semibold mb-1">✔️ Confermati ({lists.counts?.going||0})</div>
          <div className="space-y-1 text-sm">{lists.going?.map((a:any,i:number)=> <div key={i}>{a.profiles.first_name} {a.profiles.last_name}</div>)}</div>
        </div>
        <div className="cs-card cs-card--primary p-3">
          <div className="text-sm font-semibold mb-1">🤝 Forse ({lists.counts?.maybe||0})</div>
          <div className="space-y-1 text-sm">{lists.maybe?.map((a:any,i:number)=> <div key={i}>{a.profiles.first_name} {a.profiles.last_name}</div>)}</div>
        </div>
        <div className="cs-card cs-card--primary p-3">
          <div className="text-sm font-semibold mb-1">✖️ Non viene ({lists.counts?.declined||0})</div>
          <div className="space-y-1 text-sm">{lists.declined?.map((a:any,i:number)=> <div key={i}>{a.profiles.first_name} {a.profiles.last_name}</div>)}</div>
        </div>
        <div className="cs-card cs-card--primary p-3">
          <div className="text-sm font-semibold mb-1">⏳ Nessuna risposta ({lists.counts?.no_response||0})</div>
          <div className="space-y-1 text-sm">{lists.no_response?.map((p:any,i:number)=> <div key={i}>{p.first_name} {p.last_name}</div>)}</div>
        </div>
      </div>
    </div>
  )
}

function EventForm({ 
  event, 
  gyms,
  activities,
  teams,
  onSubmit, 
  onCancel 
}: { 
  event: Event | null
  gyms: Gym[]
  activities: Activity[]
  teams: Team[]
  onSubmit: (data: Omit<Event, 'id'>) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState({
    title: event?.title || '',
    description: event?.description || '',
    start_date: event?.start_date ? new Date(event.start_date).toISOString().slice(0, 16) : '',
    end_date: event?.end_date ? new Date(event.end_date).toISOString().slice(0, 16) : '',
    location: event?.location || '',
    gym_id: event?.gym_id || '',
    activity_id: event?.activity_id || '',
    event_type: event?.event_type || 'one_time',
    event_kind: (event as any)?.event_kind || 'training',
    recurrence_rule: (event?.recurrence_rule as any) || { frequency: 'weekly', interval: 1 },
    recurrence_end_date: event?.recurrence_end_date ? new Date(event.recurrence_end_date).toISOString().slice(0,16) : '',
    selected_teams: event?.event_teams?.map(et => et.teams.id) || []
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      ...formData,
      start_date: new Date(formData.start_date).toISOString(),
      end_date: new Date(formData.end_date).toISOString(),
      recurrence_rule: formData.event_type === 'recurring' ? formData.recurrence_rule : undefined,
      recurrence_end_date: formData.event_type === 'recurring' && formData.recurrence_end_date ? new Date(formData.recurrence_end_date).toISOString() : undefined,
      gym_id: formData.gym_id || undefined,
      activity_id: formData.activity_id || undefined,
      selected_teams: formData.selected_teams,
      event_kind: (formData as any).event_kind || 'training'
    })
  }

  const handleTeamSelection = (teamId: string) => {
    setFormData(prev => ({
      ...prev,
      selected_teams: prev.selected_teams.includes(teamId)
        ? prev.selected_teams.filter(id => id !== teamId)
        : [...prev.selected_teams, teamId]
    }))
  }

  return (
    <div className="cs-card p-6">
      <h3 className="text-lg font-semibold mb-4">
        {event ? 'Modifica Evento' : 'Nuovo Evento'}
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="cs-field__label">
            Titolo Evento *
          </label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="cs-input"
            placeholder="Es: Allenamento Under 15, Partita amichevole..."
          />
        </div>

        <div>
          <label className="cs-field__label">
            Descrizione
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="cs-textarea"
            placeholder="Descrizione dell'evento (opzionale)"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="cs-field__label">
              Data/Ora Inizio *
            </label>
            <input
              type="datetime-local"
              required
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              className="cs-input"
            />
          </div>

          <div>
            <label className="cs-field__label">
              Data/Ora Fine *
            </label>
            <input
              type="datetime-local"
              required
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              className="cs-input"
            />
          </div>
        </div>

        <div>
          <label className="cs-field__label">
            Luogo
          </label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            className="cs-input"
            placeholder="Indirizzo o luogo specifico"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="cs-field__label">
              Palestra
            </label>
            <select
              value={formData.gym_id}
              onChange={(e) => setFormData({ ...formData, gym_id: e.target.value })}
              className="cs-select"
            >
              <option value="">Seleziona una palestra</option>
              {gyms.map((gym) => (
                <option key={gym.id} value={gym.id}>
                  {gym.name} - {gym.city}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="cs-field__label">
              Attività
            </label>
            <select
              value={formData.activity_id}
              onChange={(e) => setFormData({ ...formData, activity_id: e.target.value })}
              className="cs-select"
            >
              <option value="">Seleziona un&apos;attività</option>
              {activities.map((activity) => (
                <option key={activity.id} value={activity.id}>
                  {activity.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="cs-field__label">
            Tipo Evento
          </label>
          <select
            value={formData.event_type}
            onChange={(e) => setFormData({ ...formData, event_type: e.target.value as 'one_time' | 'recurring' })}
            className="cs-select"
          >
            <option value="one_time">Evento Singolo</option>
            <option value="recurring">Evento Ricorrente</option>
          </select>
        </div>

        <div>
          <label className="cs-field__label">Tipologia</label>
          <select
            value={(formData as any).event_kind}
            onChange={(e) => setFormData({ ...formData, event_kind: e.target.value as any })}
            className="cs-select"
          >
            <option value="training">Allenamento</option>
            <option value="match">Partita</option>
            <option value="meeting">Riunione</option>
            <option value="other">Altro</option>
          </select>
        </div>

        {formData.event_type === 'recurring' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="cs-field__label">Frequenza</label>
              <select
                value={formData.recurrence_rule.frequency}
                onChange={(e) => setFormData({ ...formData, recurrence_rule: { ...formData.recurrence_rule, frequency: e.target.value as any } })}
                className="cs-select"
              >
                <option value="daily">Giornaliera</option>
                <option value="weekly">Settimanale</option>
                <option value="monthly">Mensile</option>
              </select>
            </div>
            <div>
              <label className="cs-field__label">Intervallo</label>
              <input
                type="number"
                min={1}
                value={formData.recurrence_rule.interval || 1}
                onChange={(e) => setFormData({ ...formData, recurrence_rule: { ...formData.recurrence_rule, interval: Number(e.target.value) } })}
                className="cs-input"
              />
            </div>
            <div>
              <label className="cs-field__label">Fine Ricorrenza</label>
              <input
                type="datetime-local"
                value={formData.recurrence_end_date}
                onChange={(e) => setFormData({ ...formData, recurrence_end_date: e.target.value })}
                className="cs-input"
              />
            </div>
          </div>
        )}

        <div>
          <label className="cs-field__label">
            Squadre Associate
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
            {teams.map((team) => (
              <label key={team.id} className="flex items-center">
                <input type="checkbox" checked={formData.selected_teams.includes(team.id)} onChange={() => handleTeamSelection(team.id)} className="h-4 w-4" />
                <span className="ml-2 text-sm">
                  {team.name} ({team.code})
                </span>
              </label>
            ))}
          </div>
          {teams.length === 0 && (
            <p className="text-xs text-secondary mt-1">
              Nessuna squadra disponibile. Crea prima delle squadre.
            </p>
          )}
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button type="button" onClick={onCancel} className="cs-btn cs-btn--ghost">Annulla</button>
          <button type="submit" className="cs-btn cs-btn--primary">{event ? 'Aggiorna' : 'Crea'} Evento</button>
        </div>
      </form>
    </div>
  )
}
