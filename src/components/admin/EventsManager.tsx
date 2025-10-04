'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { exportToExcel } from '@/lib/utils/excelExport'
import SimpleCalendar, { CalEvent } from '@/components/calendar/SimpleCalendar'
import DetailsDrawer from '@/components/shared/DetailsDrawer'
import EventModal from '@/components/admin/EventModal'

const KIND_COLORS: Record<'training'|'match'|'meeting'|'other', string> = {
  training: '#413c67', // Allenamento (blu CSRoma)
  match:    '#d71920', // Partita (rosso CSRoma)
  meeting:  '#f5eb00', // Riunione (giallo CSRoma)
  other:    '#6b7280', // Altro (grigio)
}

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
  const [filterTeam, setFilterTeam] = useState<string>('')
  const [filterFrom, setFilterFrom] = useState<string>('')
  const [filterTo, setFilterTo] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [viewMode, setViewMode] = useState<'list'|'calendar'>('list')
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [calView, setCalView] = useState<'month'|'week'>('month')
  const supabase = createClient()

  useEffect(() => {
    loadEvents()
    loadGyms()
    loadActivities()
    loadTeams()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadEvents = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterTeam) params.set('team_id', filterTeam)
      if (filterFrom) params.set('from', new Date(filterFrom).toISOString())
      if (filterTo) params.set('to', new Date(filterTo).toISOString())
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
      const eventsWithSafeData = (result.events || []).map(event => ({
        ...event,
        gyms: event.gyms || null,
        activities: event.activities || null,
        event_teams: event.event_teams || [],
        created_by_profile: event.created_by_profile || null
      }))
      setEvents(eventsWithSafeData)
      setLoading(false)
    } catch (error) {
      console.error('Errore caricamento eventi:', error)
      setEvents([])
      setLoading(false)
    }
  }

  const loadGyms = async () => {
    const { data } = await supabase
      .from('gyms')
      .select('id, name, address, city')
      .order('name')

    setGyms(data || [])
  }

  const loadActivities = async () => {
    const { data } = await supabase
      .from('activities')
      .select('id, name')
      .order('name')

    setActivities(data || [])
  }

  const loadTeams = async () => {
    const { data } = await supabase
      .from('teams')
      .select('id, name, code')
      .order('name')

    setTeams(data || [])
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
        alert(`Errore: ${result.error}`)
        return
      }

      console.log('Evento creato con successo:', result.message)
      setShowModal(false)
      setEditingEvent(null)
      loadEvents()

    } catch (error) {
      console.error('Errore creazione evento:', error)
      alert('Errore di rete durante la creazione dell\'evento')
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
        alert(`Errore: ${result.error}`)
        return
      }

      console.log('Evento aggiornato con successo:', result.message)
      setShowModal(false)
      setEditingEvent(null)
      loadEvents()

    } catch (error) {
      console.error('Errore aggiornamento evento:', error)
      alert('Errore di rete durante l\'aggiornamento dell\'evento')
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
          alert(`Errore: ${result.error}`)
          return
        }

        console.log('Evento eliminato con successo:', result.message)
        loadEvents()

      } catch (error) {
        console.error('Errore eliminazione evento:', error)
        alert('Errore di rete durante l\'eliminazione dell\'evento')
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
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Calendario e Eventi</h2>
        <div className="flex gap-3">
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
      <div className="cs-card p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="cs-field__label">Squadra</label>
            <select
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
              className="cs-select"
            >
              <option value="">Tutte le squadre</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
              ))}
            </select>
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
            <button onClick={() => { setFilterTeam(''); setFilterFrom(''); setFilterTo(''); setLoading(true); loadEvents(); }} className="cs-btn cs-btn--ghost">Reset</button>
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
        <div className="cs-card p-4">
          <SimpleCalendar
            currentDate={currentDate}
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
          />
        </div>
      ) : (
      <div className="cs-card overflow-hidden">
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
                  <span className={`cs-badge ${event.event_type==='one_time'?'cs-badge--neutral':'cs-badge--accent'}`}>
                    {event.event_type === 'one_time' ? 'Singolo' : 'Ricorrente'}
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

        {events.length === 0 && (
          <div className="px-6 py-8 text-center">
            <div className="text-secondary mb-4"><span className="text-4xl">📅</span></div>
            <h3 className="text-lg font-semibold mb-2">Nessun evento creato</h3>
            <p className="text-secondary mb-4">Crea il tuo primo evento per iniziare a organizzare il calendario delle attività.</p>
            <button onClick={() => { setEditingEvent(null); setShowModal(true) }} className="cs-btn cs-btn--primary">Crea il tuo primo evento
            </button>
          </div>
        )}
      </div>
      )}

      {selectedEvent && (
        <DetailsDrawer open={true} title="Dettaglio Evento" onClose={() => setSelectedEvent(null)}>
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs text-secondary">Titolo</div>
              <div className="font-medium">{selectedEvent.title}</div>
            </div>
            {selectedEvent.description && (
              <div>
                <div className="text-xs text-secondary">Descrizione</div>
                <div>{selectedEvent.description}</div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-secondary">Inizio</div>
                <div>{new Date(selectedEvent.start_date).toLocaleString('it-IT')}</div>
              </div>
              <div>
                <div className="text-xs text-secondary">Fine</div>
                <div>{new Date(selectedEvent.end_date).toLocaleString('it-IT')}</div>
              </div>
            </div>
            {selectedEvent.location && (
              <div>
                <div className="text-xs text-secondary">Luogo</div>
                <div>{selectedEvent.location}</div>
              </div>
            )}
            <div>
              <div className="text-xs text-secondary">Squadre</div>
              <div>{(selectedEvent.event_teams || []).map(et => et.teams?.name).filter(Boolean).join(', ') || 'N/D'}</div>
            </div>
            {selectedEvent.created_by_profile && (
              <div>
                <div className="text-xs text-secondary">Creato da</div>
                <div>{selectedEvent.created_by_profile.first_name} {selectedEvent.created_by_profile.last_name}</div>
              </div>
            )}
            <div>
              <div className="text-xs text-secondary">Tipo</div>
              <div>{selectedEvent.event_type === 'one_time' ? 'Singolo' : 'Ricorrente'}</div>
            </div>
          </div>
        </DetailsDrawer>
      )}
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
