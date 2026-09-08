'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { exportToExcel } from '@/lib/utils/excelExport'
import MonthlyMobileCalendar from '@/components/calendar/MonthlyMobileCalendar'
import FullCalendarWidget from '@/components/calendar/FullCalendarWidget'
import { EmptyState, EventKindBadge, LoadingState, toast } from '@/components/ui'
import { AdminRowCheckbox, AdminSelectionBar } from '@/components/admin/AdminManagement'
import DetailsDrawer from '@/components/shared/DetailsDrawer'
import EventDetailModal from '@/components/shared/EventDetailModal'
import EventModal from '@/components/admin/EventModal'
import { BarChart3, SlidersHorizontal } from 'lucide-react'
import { EVENT_KIND_OPTIONS, eventKindLabel, eventKindVisual } from '@/lib/events/event-kind'
import { ResponsiveDetail } from '@/components/ui'

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
  selected_teams?: string[]
  requires_confirmation?: boolean
  confirmation_deadline?: string | null
  
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

function visibleMonthRange(date: Date): { from: string; to: string } {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const mondayOffset = (first.getDay() + 6) % 7
  first.setDate(first.getDate() - mondayOffset)
  const last = new Date(first)
  last.setDate(last.getDate() + 41)
  last.setHours(23, 59, 59, 999)
  return { from: first.toISOString(), to: last.toISOString() }
}

export default function EventsManager({ embedded = false }: { embedded?: boolean }) {
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
  const [initialLoading, setInitialLoading] = useState(true)
  const [loadingSelects, setLoadingSelects] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [viewMode, setViewMode] = useState<'list'|'calendar'>('calendar')
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [calView, setCalView] = useState<'month'|'week'>('month')
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false)
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([])
  const teamDropdownRef = useRef<HTMLDivElement | null>(null)
  const eventKindDropdownRef = useRef<HTMLDivElement | null>(null)
  const requestedVisibleRangeRef = useRef<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

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

  const visibleRequest = (date = currentDate) => {
    const range = visibleMonthRange(date)
    return {
      from: filterFrom || range.from,
      to: filterTo ? `${filterTo}T23:59:59.999` : range.to,
      visible: true,
    }
  }

  useEffect(() => {
    loadEvents(visibleRequest(new Date()))
    loadTeams()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    visible?: boolean
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
      if (overrides?.visible) {
        params.set('visible', '1')
        requestedVisibleRangeRef.current = [selectedTeamIds.join(','), selectedEventKinds.join(','), selectedFrom, selectedTo].join('|')
      }
      params.set('limit', overrides?.visible ? '500' : '5000')
      const qs = params.toString()
      const response = await fetch(`/api/admin/events${qs ? `?${qs}` : ''}`)
      const result = await response.json()

      if (!response.ok) {
        console.error('Errore caricamento eventi:', result.error)
        setEvents([])
        setLoading(false)
        setInitialLoading(false)
        return
      }

      // Assicurati che i dati correlati siano sempre oggetti validi
      let eventsWithSafeData = (result.events || []).map((event: Event) => ({
        ...event,
        gyms: event.gyms || null,
        activities: event.activities || null,
        event_teams: event.event_teams || [],
        created_by_profile: event.created_by_profile || null
      }))

      // Filtro locale per event_kind
      if (selectedEventKinds.length > 0) {
        eventsWithSafeData = eventsWithSafeData.filter(
          (e: Event) => !!e.event_kind && selectedEventKinds.includes(e.event_kind)
        )
      }

      setEvents(eventsWithSafeData)
      setSelectedEventIds([])
      setLoading(false)
      setInitialLoading(false)
    } catch (error) {
      console.error('Errore caricamento eventi:', error)
      setEvents([])
      setLoading(false)
      setInitialLoading(false)
    }
  }

  const loadSelectOptions = useCallback(async () => {
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
  }, [supabase])

  // Lazy load gyms/activities solo quando il modal si apre
  useEffect(() => {
    if (showModal && gyms.length === 0 && activities.length === 0) {
      void loadSelectOptions()
    }
  }, [activities.length, gyms.length, loadSelectOptions, showModal])

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

  const handleBulkDelete = async () => {
    if (selectedEventIds.length === 0) return
    if (!window.confirm(`Vuoi eliminare ${selectedEventIds.length} eventi selezionati?`)) return
    const results = await Promise.all(selectedEventIds.map(async (id) => {
      const response = await fetch(`/api/admin/events?id=${encodeURIComponent(id)}&scope=one`, { method: 'DELETE' })
      return response.ok
    }))
    const deletedCount = results.filter(Boolean).length
    if (deletedCount === results.length) toast.success(`${deletedCount} eventi eliminati`)
    else toast.error(`${deletedCount} eventi eliminati; alcuni non sono stati rimossi`)
    setSelectedEventIds([])
    void loadEvents(viewMode === 'calendar' ? visibleRequest() : { visible: false })
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
      { key: 'event_kind', title: 'Tipologia', width: 12, format: (val) => eventKindLabel(typeof val === 'string' ? val : null) || '' },
      { key: 'created_by_profile', title: 'Creato Da', width: 20, format: (val) => val ? `${val.first_name} ${val.last_name}` : '' }
    ], {
      filename: 'eventi_csroma',
      sheetName: 'Eventi',
      headerStyle: { fill: { fgColor: { rgb: '3498DB' } } }
    })
  }

  const navigateCalendar = (action: 'prev' | 'next' | 'today') => {
    const nextDate = new Date(currentDate)
    if (action === 'today') {
      nextDate.setTime(Date.now())
    } else {
      nextDate.setMonth(nextDate.getMonth() + (action === 'prev' ? -1 : 1))
    }
    setCurrentDate(nextDate)
    const range = visibleMonthRange(nextDate)
    void loadEvents({
      from: filterFrom || range.from,
      to: filterTo ? `${filterTo}T23:59:59.999` : range.to,
      visible: true,
    })
  }

  const openCreateForDay = (date: Date) => {
    const start = new Date(date)
    start.setHours(18, 0, 0, 0)
    const end = new Date(start)
    end.setHours(19, 0, 0, 0)
    setEditingEvent({
      title: '', description: '', start_date: start.toISOString(), end_date: end.toISOString(),
      location: '', gym_id: '', activity_id: '', event_type: 'one_time', event_kind: 'training',
      recurrence_rule: { frequency: 'weekly', interval: 1 }, recurrence_end_date: '', selected_teams: [],
    })
    setShowModal(true)
  }

  if (initialLoading) {
    return <LoadingState label="Caricamento eventi..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {!embedded && <h2 className="text-2xl font-bold">Calendario e Eventi</h2>}
          {loading && <span className="text-xs text-secondary" role="status" aria-live="polite">Aggiornamento eventi…</span>}
        </div>
        <div className="flex flex-col gap-2 w-full md:w-auto md:flex-row md:flex-wrap md:gap-3">
          <button onClick={exportEventsToExcel} className="cs-btn cs-btn--outline">
            <BarChart3 className="mr-2 h-4 w-4" aria-hidden="true" />
            Export Excel
          </button>
          <button onClick={() => { setEditingEvent(null); setShowModal(true) }} className="cs-btn cs-btn--primary">
            Nuovo Evento
          </button>
          <button onClick={() => {
            const nextMode = viewMode === 'list' ? 'calendar' : 'list'
            setViewMode(nextMode)
            if (nextMode === 'calendar') {
              const range = visibleMonthRange(currentDate)
              void loadEvents({ from: range.from, to: range.to, visible: true })
            } else {
              void loadEvents({ visible: false })
            }
          }} className="cs-btn cs-btn--ghost">
            {viewMode === 'list' ? 'Vista Calendario' : 'Vista Elenco'}
          </button>
        </div>
      </div>

      {/* Filtri */}
      <div className="hidden md:block cs-card cs-card--primary p-4">
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
            <button onClick={() => viewMode === 'calendar'
              ? loadEvents(visibleRequest())
              : loadEvents({ visible: false })} className="cs-btn cs-btn--primary">Applica filtri</button>
            <button
              onClick={() => {
                setFilterTeams([])
                setFilterEventKinds([])
                setFilterFrom('')
                setFilterTo('')
                loadEvents(viewMode === 'calendar'
                  ? { teamIds: [], eventKinds: [], ...visibleMonthRange(currentDate), visible: true }
                  : { teamIds: [], eventKinds: [], from: '', to: '', visible: false })
              }}
              className="cs-btn cs-btn--ghost"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="md:hidden">
        <button
          type="button"
          className="cs-btn cs-btn--outline w-full justify-between"
          onClick={() => setIsFilterSheetOpen(true)}
          aria-haspopup="dialog"
        >
          <span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filtri</span>
          <span className="text-xs text-secondary">{filterTeams.length + filterEventKinds.length + (filterFrom || filterTo ? 1 : 0)} attivi</span>
        </button>
      </div>

      <ResponsiveDetail
        open={isFilterSheetOpen}
        onOpenChange={setIsFilterSheetOpen}
        title="Filtri calendario"
        description="Restringi gli eventi per squadra, tipologia e intervallo."
        fullscreenOnMobile
        footer={<div className="flex w-full gap-2"><button type="button" className="cs-btn cs-btn--ghost flex-1" onClick={() => {
          setFilterTeams([]); setFilterEventKinds([]); setFilterFrom(''); setFilterTo('')
          void loadEvents({ teamIds: [], eventKinds: [], ...visibleMonthRange(currentDate), visible: true })
          setIsFilterSheetOpen(false)
        }}>Reset</button><button type="button" className="cs-btn cs-btn--primary flex-1" onClick={() => {
          void loadEvents(visibleRequest()); setIsFilterSheetOpen(false)
        }}>Applica</button></div>}
      >
        <div className="space-y-5">
          <fieldset>
            <legend className="cs-field__label">Squadre</legend>
            <div className="space-y-1" role="group" aria-label="Filtra per squadre">
              {teams.map((team) => <label key={team.id} className="flex min-h-[44px] items-center gap-3 rounded-md px-2">
                <input type="checkbox" checked={filterTeams.includes(team.id)} onChange={() => toggleTeamFilter(team.id)} className="h-4 w-4" />
                <span className="text-sm">{team.name} ({team.code})</span>
              </label>)}
              {teams.length === 0 && <p className="text-sm text-secondary">Nessuna squadra disponibile</p>}
            </div>
            <div className="mt-2 flex gap-4"><button type="button" className="text-xs font-medium text-primary" onClick={selectAllTeams}>Seleziona tutte</button><button type="button" className="text-xs font-medium text-secondary" onClick={() => setFilterTeams([])}>Svuota</button></div>
          </fieldset>
          <fieldset>
            <legend className="cs-field__label">Tipologia</legend>
            <div className="space-y-1" role="group" aria-label="Filtra per tipologia evento">
              {EVENT_KIND_OPTIONS.map((option) => <label key={option.value} className="flex min-h-[44px] items-center gap-3 rounded-md px-2">
                <input type="checkbox" checked={filterEventKinds.includes(option.value)} onChange={() => toggleEventKindFilter(option.value)} className="h-4 w-4" />
                <span className="text-sm">{option.label}</span>
              </label>)}
            </div>
            <div className="mt-2 flex gap-4"><button type="button" className="text-xs font-medium text-primary" onClick={selectAllEventKinds}>Seleziona tutte</button><button type="button" className="text-xs font-medium text-secondary" onClick={() => setFilterEventKinds([])}>Svuota</button></div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3"><label className="cs-field__label">Dal<input type="date" value={filterFrom} onChange={(event) => setFilterFrom(event.target.value)} className="cs-input mt-1" /></label><label className="cs-field__label">Al<input type="date" value={filterTo} onChange={(event) => setFilterTo(event.target.value)} className="cs-input mt-1" /></label></div>
        </div>
      </ResponsiveDetail>

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
        <>
        <div className="md:hidden">
          <MonthlyMobileCalendar
            currentDate={currentDate}
            events={events.map((event) => ({
              id: event.id!,
              title: event.title,
              start: event.start_date,
              end: event.end_date,
              eventKind: event.event_kind,
              location: event.location || event.gyms?.name,
            }))}
            onNavigate={navigateCalendar}
            onEventClick={(id) => {
              const event = events.find((item) => item.id === id)
              if (event) setSelectedEvent(event)
            }}
            onCreateEvent={openCreateForDay}
          />
        </div>
        <div className="hidden md:block">
        <FullCalendarWidget
          initialDate={currentDate}
          view={calView}
          events={(events||[]).map((e:any)=>({
            id: e.id!,
            title: e.title,
            start: new Date(e.start_date),
            end: new Date(e.end_date),
            color: eventKindVisual(e.event_kind)?.colorToken,
          }))}
          onNavigate={(act)=>{
            const d = act === 'today' ? new Date() : new Date(currentDate)
            if (act==='prev') { if (calView==='month') d.setMonth(d.getMonth()-1); else d.setDate(d.getDate()-7) }
            else if (act==='next') { if (calView==='month') d.setMonth(d.getMonth()+1); else d.setDate(d.getDate()+7) }
            setCurrentDate(d)
            const range = visibleMonthRange(d)
            void loadEvents({ from: range.from, to: range.to, visible: true })
          }}
          onViewChange={(v)=>setCalView(v)}
          onVisibleRangeChange={(start, end) => {
            const from = filterFrom || start.toISOString()
            const to = filterTo ? `${filterTo}T23:59:59.999` : end.toISOString()
            const requestKey = [filterTeams.join(','), filterEventKinds.join(','), from, to].join('|')
            if (requestedVisibleRangeRef.current === requestKey) return
            requestedVisibleRangeRef.current = requestKey
            void loadEvents({
              from,
              to,
              visible: true,
            })
          }}
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
        </div>
        </>
      ) : (
      <div className="cs-card cs-card--primary overflow-hidden">
        <AdminSelectionBar
          selectedCount={selectedEventIds.length}
          totalCount={events.length}
          onClear={() => setSelectedEventIds([])}
        >
          <button type="button" className="cs-btn cs-btn--danger cs-btn--sm" onClick={() => void handleBulkDelete()}>
            Elimina selezionati
          </button>
        </AdminSelectionBar>
        {/* Desktop */}
        <div className="hidden md:block">
        <table className="cs-table">
          <thead>
            <tr>
              <th className="w-12"><AdminRowCheckbox id="select-all-events" checked={events.length > 0 && selectedEventIds.length === events.length} onChange={(checked) => setSelectedEventIds(checked ? events.flatMap((event) => event.id ? [event.id] : []) : [])} label="Seleziona tutti gli eventi" /></th>
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
              <tr key={event.id} className="hover:bg-gray-50">
                <td className="px-4 py-4"><AdminRowCheckbox id={`select-event-${event.id}`} checked={Boolean(event.id && selectedEventIds.includes(event.id))} onChange={(checked) => event.id && setSelectedEventIds((current) => checked ? [...new Set([...current, event.id!])] : current.filter((id) => id !== event.id))} label={`Seleziona ${event.title}`} /></td>
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
                    {event.location || (event.gyms && `${event.gyms.name}, ${event.gyms.city}`) || 'Nessuna palestra/luogo assegnato'}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div>
                    {(event.event_teams || []).map(et => et.teams?.name).filter(Boolean).join(', ') || 'Nessuna squadra assegnata'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <EventKindBadge kind={event.event_kind} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium cs-table__actions">
                  <button type="button" onClick={() => setSelectedEvent(event)} className="cs-btn cs-btn--ghost cs-btn--sm">Dettagli</button>
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
            <article key={event.id} className="cs-card">
              <div className="flex items-start gap-2"><AdminRowCheckbox id={`select-event-mobile-${event.id}`} checked={Boolean(event.id && selectedEventIds.includes(event.id))} onChange={(checked) => event.id && setSelectedEventIds((current) => checked ? [...new Set([...current, event.id!])] : current.filter((id) => id !== event.id))} label={`Seleziona ${event.title}`} /><div className="min-w-0 flex-1 font-semibold">{event.title}</div></div>
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
                <div><strong>Luogo:</strong> {event.location || (event.gyms && `${event.gyms.name}, ${event.gyms.city}`) || 'Nessuna palestra/luogo assegnato'}</div>
                <div><strong>Squadre:</strong> {(event.event_teams || []).map(et => et.teams?.name).filter(Boolean).join(', ') || 'Nessuna squadra assegnata'}</div>
                <div>
                  <strong>Tipo:</strong>
                  <EventKindBadge kind={event.event_kind} className="ml-2" />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setSelectedEvent(event)} className="cs-btn cs-btn--ghost cs-btn--sm flex-1">Dettagli</button>
                <button onClick={(e) => { e.stopPropagation(); setEditingEvent(event); setShowModal(true) }} className="cs-btn cs-btn--outline cs-btn--sm flex-1">Modifica</button>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id!) }} className="cs-btn cs-btn--danger cs-btn--sm flex-1">Elimina</button>
              </div>
            </article>
          ))}
          {events.length === 0 && (
            <EmptyState
              title="Nessun evento creato"
              description="Crea il tuo primo evento per iniziare a organizzare il calendario delle attività."
              action={<button onClick={() => { setEditingEvent(null); setShowModal(true) }} className="cs-btn cs-btn--primary">Crea il tuo primo evento</button>}
            />
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
            description: selectedEvent.description || '',
            requires_confirmation: selectedEvent.requires_confirmation,
            confirmation_deadline: selectedEvent.confirmation_deadline,
          }}
        >
          {selectedEvent.requires_confirmation && selectedEvent.id && (
            <EventAttendancePanel eventId={selectedEvent.id} />
          )}
        </EventDetailModal>
      )}
    </div>
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

function EventAttendancePanel({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(true)
  const [lists, setLists] = useState<AttendanceReport>(emptyAttendanceReport)
  useEffect(() => { (async () => {
    try {
      const res = await fetch(`/api/admin/events/attendance?event_id=${eventId}`)
      const j = await res.json() as Partial<AttendanceReport>
      if (res.ok) {
        setLists({
          going: j.going ?? [],
          maybe: j.maybe ?? [],
          declined: j.declined ?? [],
          no_response: j.no_response ?? [],
          counts: j.counts ?? emptyAttendanceReport.counts,
        })
      }
    } finally { setLoading(false) }
  })() }, [eventId])

  if (loading) return <div className="text-xs text-secondary mt-2">Caricamento conferme…</div>
  const names = (entry: AttendanceEntry | AttendanceProfile) => {
    const profile = 'profiles' in entry ? entry.profiles : entry
    return profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Profilo non disponibile'
  }
  const renderNames = (entries: Array<AttendanceEntry | AttendanceProfile>) => (
    entries.length > 0
      ? entries.map((entry) => <div key={'profile_id' in entry ? entry.profile_id : entry.id}>{names(entry)}</div>)
      : <div className="text-secondary">Nessun atleta</div>
  )
  return (
    <div className="mt-4 border-t border-[color:var(--cs-border)] pt-4" aria-label="Report conferme partecipazione">
      <div className="text-sm font-semibold mb-3">Report conferme partecipazione</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="cs-card cs-card--primary p-3">
          <div className="text-sm font-semibold mb-1">Confermati ({lists.counts.going})</div>
          <div className="space-y-1 text-sm">{renderNames(lists.going)}</div>
        </div>
        <div className="cs-card cs-card--primary p-3">
          <div className="text-sm font-semibold mb-1">Forse ({lists.counts.maybe})</div>
          <div className="space-y-1 text-sm">{renderNames(lists.maybe)}</div>
        </div>
        <div className="cs-card cs-card--primary p-3">
          <div className="text-sm font-semibold mb-1">Non partecipano ({lists.counts.declined})</div>
          <div className="space-y-1 text-sm">{renderNames(lists.declined)}</div>
        </div>
        <div className="cs-card cs-card--primary p-3">
          <div className="text-sm font-semibold mb-1">Nessuna risposta ({lists.counts.no_response})</div>
          <div className="space-y-1 text-sm">{renderNames(lists.no_response)}</div>
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
            {EVENT_KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
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
