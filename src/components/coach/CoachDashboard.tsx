'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import DetailsDrawer from '@/components/shared/DetailsDrawer'

interface User {
  id: string
  email: string
}

interface Profile {
  id: string
  first_name: string
  last_name: string
  role: string
}

interface Team {
  id: string
  name: string
  code: string
  activity_id?: string
  activity: {
    name: string
  }
}

interface Event {
  id: string
  title: string
  start_date: string
  end_date: string
  location?: string
  event_type: string
  teams?: string
}

interface Message {
  id: string
  subject: string
  content: string
  created_at: string
  unread_count?: number
}

interface Payment {
  id: string
  description: string
  amount: number
  status: string
  due_date?: string
}

interface CoachDashboardProps {
  user: User
  profile: Profile
}

export default function CoachDashboard({ user, profile }: CoachDashboardProps) {
  const [teams, setTeams] = useState<Team[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([])
  const [recentMessages, setRecentMessages] = useState<Message[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSeason, setActiveSeason] = useState<any>(null)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [messageDetail, setMessageDetail] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    loadCoachData()
  }, [])

  // Enrich selected message on open
  useEffect(() => {
    const loadDetail = async () => {
      if (!selectedMessage) { setMessageDetail(null); return }
      try {
        const res = await fetch(`/api/coach/messages?view=full&id=${selectedMessage.id}`)
        const json = await res.json()
        if (res.ok && json.messages && json.messages.length) {
          setMessageDetail(json.messages[0])
        }
      } catch {}
    }
    loadDetail()
  }, [selectedMessage])

  const loadCoachData = async () => {
    setLoading(true)
    
    try {
      // Carica in sequenza per evitare dipendenze circolari
      await loadActiveSeason()
      const teamIds = await loadCoachTeams() // Ottieni gli ID delle squadre
      
      if (teamIds.length > 0) {
        await Promise.all([
          loadUpcomingEvents(teamIds), // Passa gli ID direttamente
          loadRecentMessages(teamIds),
          loadPayments()
        ])
      } else {
        // Se non ci sono squadre, svuota gli stati dipendenti
        setUpcomingEvents([])
        setRecentMessages([])
      }
    } catch (error) {
      console.error('Error loading coach data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadActiveSeason = async () => {
    const { data } = await supabase
      .from('seasons')
      .select('*')
      .eq('is_active', true)
      .single()
    if (data) setActiveSeason(data)
  }

  const loadCoachTeams = async () => {
    const { data } = await supabase
      .from('team_coaches')
      .select('team_id, teams(id, name, code, activity_id)')
      .eq('coach_id', user.id)

    if (!data || data.length === 0) {
      setTeams([])
      return []
    }

    const teamRecords = data
      .map((row) => row.teams)
      .filter(Boolean) as Team[]

    const activityIds = [...new Set(teamRecords.map(team => team.activity_id).filter(Boolean))]
    let activities: any[] = []

    if (activityIds.length > 0) {
      const { data: activitiesData } = await supabase
        .from('activities')
        .select('id, name')
        .in('id', activityIds)

      activities = activitiesData || []
    }

    const teamsWithActivities = teamRecords.map(team => ({
      ...team,
      activity: activities.find((activity: any) => activity.id === team.activity_id) || { name: 'N/A' }
    }))

    setTeams(teamsWithActivities)
    return teamsWithActivities.map(team => team.id)
  }

  const loadUpcomingEvents = async (teamIds: string[]) => {
    console.log('Loading events for team IDs:', teamIds)
    
    if (teamIds.length === 0) {
      console.log('No teams assigned to coach, setting empty events')
      setUpcomingEvents([])
      return
    }
    
    // Query alternativa: prima trova gli event IDs per le squadre, poi carica gli eventi
    const { data: eventRelations, error: relationError } = await supabase
      .from('event_teams')
      .select('event_id')
      .in('team_id', teamIds)
      .order('created_at', { ascending: false })

    if (relationError) {
      console.error('Error loading event relations:', relationError)
      return
    }

    if (!eventRelations || eventRelations.length === 0) {
      console.log('No event relations found for coach teams')
      setUpcomingEvents([])
      return
    }

    const eventIds = [...new Set(eventRelations.map(er => er.event_id))]
    
    // Carica gli eventi futuri per gli IDs trovati
    const { data: events, error } = await supabase
      .from('events')
      .select('id, title, start_date, end_date, location, event_type')
      .in('id', eventIds)
      .gte('start_date', new Date().toISOString().split('T')[0] + 'T00:00:00')
      .order('start_date', { ascending: true })
      .limit(3)

    if (error) {
      console.error('Error loading events:', error)
      return
    }

    console.log('Coach upcoming events:', events)

    if (events && events.length > 0) {
      // Per ogni evento, carica i nomi delle squadre associate
      const eventsWithTeamNames = await Promise.all(
        events.map(async (event) => {
          const { data: eventTeams } = await supabase
            .from('event_teams')
            .select('team_id')
            .eq('event_id', event.id)
            .in('team_id', teamIds)
          
          const teamNames = eventTeams 
            ? eventTeams
                .map(et => teams.find(t => t.id === et.team_id)?.name)
                .filter(Boolean)
                .join(', ')
            : ''
          
          return {
            ...event,
            teams: teamNames
          }
        })
      )
      
      setUpcomingEvents(eventsWithTeamNames)
    } else {
      console.log('No upcoming events found for coach teams')
      setUpcomingEvents([])
    }
  }

  const loadRecentMessages = async (teamIds: string[]) => {
    // Get recent messages sent to coach's teams
    if (teamIds.length === 0) {
      setRecentMessages([])
      return
    }

    try {
      console.log('Loading messages for team IDs:', teamIds)
      
      // Use API endpoint to avoid RLS recursion issues
      const response = await fetch('/api/coach/messages', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        console.error('API error loading messages:', response.status)
        setRecentMessages([])
        return
      }

      const result = await response.json()
      
      if (result.error) {
        console.error('Error from messages API:', result.error)
        setRecentMessages([])
        return
      }

      console.log('Coach messages from API:', result.messages)

      if (result.messages && result.messages.length > 0) {
        const messagesWithUnread = result.messages.map((msg: any) => ({
          ...msg,
          unread_count: 0 // Placeholder for unread count
        }))
        setRecentMessages(messagesWithUnread)
      } else {
        setRecentMessages([])
      }
    } catch (error) {
      console.error('Error in loadRecentMessages:', error)
      setRecentMessages([])
    }
  }

  const loadPayments = async () => {
    // Get coach payments
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('coach_id', user.id)
      .eq('type', 'coach_payment')
      .order('due_date', { ascending: true })
      .limit(5)

    if (data) setPayments(data)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="cs-card">
        <h2 className="text-xl font-semibold mb-4">
          Bentornato, {profile.first_name} {profile.last_name}
        </h2>
        
        {activeSeason && (
          <div className="cs-card mb-4">
            <h3 className="font-semibold">Stagione</h3>
            <p>{activeSeason.name}</p>
            <p className="text-secondary text-sm">
              {new Date(activeSeason.start_date).toLocaleDateString('it-IT')} - 
              {new Date(activeSeason.end_date).toLocaleDateString('it-IT')}
            </p>
          </div>
        )}

        <div className="cs-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
  <div className="cs-card p-6">
    <div className="text-sm text-secondary">Squadre Assegnate</div>
    <div className="text-2xl font-bold">{teams.length}</div>
    <div className="text-xs text-secondary">in totale</div>
  </div>

  <div className="cs-card p-6">
    <div className="text-sm text-secondary">Prossimi Eventi</div>
    <div className="text-2xl font-bold">{upcomingEvents.length}</div>
    <div className="text-xs text-secondary">in calendario</div>
  </div>

  <div className="cs-card p-6">
    <div className="text-sm text-secondary">Messaggi Recenti</div>
    <div className="text-2xl font-bold">{recentMessages.length}</div>
    <div className="text-xs text-secondary">ricevuti</div>
  </div>
</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Teams Section */}
        <div className="cs-card">
          <h3 className="font-semibold mb-4">Le Tue Squadre</h3>
          {teams.length === 0 ? (
            <p className="text-secondary text-sm">Nessuna squadra assegnata</p>
          ) : (
            <div className="cs-list">
              {teams.map((team) => (
                <div key={team.id} className="cs-list-item">
                  <div>
                    <div className="font-medium">{team.name}</div>
                    <div className="text-sm text-secondary">Codice: {team.code}</div>
                    <div className="text-sm text-secondary">Attività: {team.activity?.name}</div>
                  </div>
                  <div className="text-right">
                    <span className="cs-badge cs-badge--success">Attiva</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions removed: replaced by role-based sidebar */}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Events */}
        <div className="cs-card">
          <h3 className="font-semibold mb-4">Prossimi Eventi</h3>
          {upcomingEvents.length === 0 ? (
            <p className="text-secondary text-sm">Nessun evento programmato</p>
          ) : (
            <div className="cs-list">
              {upcomingEvents.map((event) => {
                const startDate = new Date(event.start_date)
                const endDate = new Date(event.end_date)
                
                return (
                  <div key={event.id} className="cs-list-item cursor-pointer" onClick={() => setSelectedEvent(event)}>
                    <div className="font-medium">{event.title}</div>
                    <div className="text-sm">
                      📅 {startDate.toLocaleDateString('it-IT')}
                    </div>
                    <div className="text-sm">
                      🕒 {startDate.toLocaleTimeString('it-IT', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })} - {endDate.toLocaleTimeString('it-IT', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                    {event.location && (<div className="text-sm text-secondary">📍 {event.location}</div>)}
                    {event.teams && (<div className="text-xs text-secondary mt-1">👥 {event.teams}</div>)}
                    <div className="text-xs text-secondary mt-1">
                      {event.event_type === 'one_time' ? 'Evento singolo' : 'Ricorrente'}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent Messages & Payments */}
        <div className="space-y-6">
          {/* Recent Messages */}
          <div className="cs-card">
            <h3 className="font-semibold mb-4">Messaggi Recenti</h3>
            {recentMessages.length === 0 ? (
              <p className="text-secondary text-sm">Nessun messaggio recente</p>
            ) : (
              <div className="cs-list">
              {recentMessages.slice(0, 3).map((message) => (
                  <div key={message.id} className="cs-list-item cursor-pointer" onClick={() => setSelectedMessage(message)}>
                    <div className="font-medium text-sm">{message.subject}</div>
                    <div className="text-xs text-secondary">
                      {new Date(message.created_at).toLocaleDateString('it-IT')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payments Summary */}
          <div className="cs-card">
            <h3 className="font-semibold mb-4">Stato Pagamenti</h3>
            {payments.length === 0 ? (
              <p className="text-secondary text-sm">Nessun pagamento in sospeso</p>
            ) : (
              <div className="cs-list">
                {payments.slice(0, 3).map((payment) => (
                  <div key={payment.id} className="cs-list-item">
                    <div className="text-sm">
                      <div className="font-medium">{payment.description}</div>
                      <div className="text-secondary">
                        €{payment.amount} - {payment.status === 'paid' ? 'Pagato' : 'Da Pagare'}
                      </div>
                    </div>
                    <span className={`cs-badge ${payment.status==='paid' ? 'cs-badge--success' : 'cs-badge--warning'}`}>
                      {payment.status === 'paid' ? 'Pagato' : 'In Sospeso'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Drawers */}
      {selectedEvent && (
        <DetailsDrawer open={true} title="Dettaglio Evento" onClose={() => setSelectedEvent(null)}>
          <div className="space-y-3 text-sm">
            <div className="font-medium">{selectedEvent.title}</div>
            <div>
              📅 {new Date(selectedEvent.start_date).toLocaleString('it-IT')} - {new Date(selectedEvent.end_date).toLocaleString('it-IT')}
            </div>
            {selectedEvent.location && <div>📍 {selectedEvent.location}</div>}
            {selectedEvent.teams && <div>👥 {selectedEvent.teams}</div>}
            <div>{selectedEvent.event_type === 'one_time' ? 'Evento singolo' : 'Ricorrente'}</div>
          </div>
        </DetailsDrawer>
      )}
      {selectedMessage && (
        <DetailsDrawer open={true} title="Dettaglio Messaggio" onClose={() => setSelectedMessage(null)}>
          <div className="space-y-3 text-sm">
            <div className="font-medium">{(messageDetail?.subject) || selectedMessage.subject}</div>
            <div className="text-secondary">{new Date(selectedMessage.created_at).toLocaleString('it-IT')}</div>
            <div className="whitespace-pre-wrap">{(messageDetail?.content) || selectedMessage.content}</div>
            {messageDetail?.created_by_profile && (
              <div>✍️ {messageDetail.created_by_profile.first_name} {messageDetail.created_by_profile.last_name}</div>
            )}
            {messageDetail?.message_recipients && messageDetail.message_recipients.length > 0 && (
              <div>
                <div className="text-secondary">Destinatari</div>
                <div className="flex flex-wrap gap-1">
                  {messageDetail.message_recipients.map((mr: any) => (
                    <span key={mr.id} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                      {mr.teams ? `🏀 ${mr.teams.name}` : mr.profiles ? `👤 ${mr.profiles.first_name} ${mr.profiles.last_name}` : '—'}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DetailsDrawer>
      )}
    </div>
  )
}
