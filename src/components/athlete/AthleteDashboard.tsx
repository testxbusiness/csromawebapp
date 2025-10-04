'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import DetailsDrawer from '@/components/shared/DetailsDrawer'

interface User {
  id: string
  email: string
}

interface AthleteProfileExtras {
  membership_number?: string | null
  medical_certificate_expiry?: string | null
  personal_notes?: string | null
}

interface Profile {
  id: string
  first_name: string
  last_name: string
  role: string
  athlete_profile?: AthleteProfileExtras | null
}

interface TeamMember {
  id: string
  jersey_number?: number
  medical_certificate_expiry?: string | null
  membership_number?: string | null
  team: {
    id: string
    name: string
    code: string
    activity: {
      name: string
    }
  }
}

interface Event {
  id: string
  title: string
  start_time: string
  end_time: string
  location?: string
  description?: string
}

interface Message {
  id: string
  subject: string
  content: string
  created_at: string
  is_read: boolean
}

interface FeeInstallment {
  id: string
  installment_number: number
  due_date: string
  amount: number
  status: string
  membership_fee: {
    name: string
    team: {
      name: string
    }
  }
}

interface AthleteDashboardProps {
  user: User
  profile: Profile
}

export default function AthleteDashboard({ user, profile }: AthleteDashboardProps) {
  const [teamMemberships, setTeamMemberships] = useState<TeamMember[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([])
  const [unreadMessages, setUnreadMessages] = useState<Message[]>([])
  const [feeInstallments, setFeeInstallments] = useState<FeeInstallment[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSeason, setActiveSeason] = useState<any>(null)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [messageDetail, setMessageDetail] = useState<any>(null)
  const supabase = createClient()

  // Enrich selected message on open
  useEffect(() => {
    const loadDetail = async () => {
      if (!selectedMessage) { return }
      try {
        const res = await fetch(`/api/athlete/messages?view=full&id=${selectedMessage.id}`)
        const json = await res.json()
        if (res.ok && json.messages && json.messages.length) {
          setMessageDetail(json.messages[0])
        }
      } catch {}
    }
    loadDetail()
  }, [selectedMessage])

  useEffect(() => {
    loadAthleteData()
  }, [])

  const loadAthleteData = async () => {
    setLoading(true)
    try {
      await loadActiveSeason()
      const memberships = await loadTeamMemberships()
      const teamIds = memberships.map(m => m.team.id)
      await Promise.all([
        loadUpcomingEvents(teamIds),
        loadUnreadMessages(teamIds),
        loadFeeInstallments()
      ])
    } catch (e) {
      console.error('Error loading athlete data:', e)
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

  const loadTeamMemberships = async () => {
    // 1) Base memberships (no joins) — avoids PostgREST relationship cache errors
    const { data: baseMemberships, error: tmError } = await supabase
      .from('team_members')
      .select('id, team_id, jersey_number')
      .eq('profile_id', user.id)

    if (tmError) {
      console.error('Error loading team memberships:', tmError)
      setTeamMemberships([])
      return [] as TeamMember[]
    }

    const teamIds = [...new Set((baseMemberships || []).map((tm: any) => tm.team_id).filter(Boolean))]

    const athleteProfile = profile?.athlete_profile

    // 3) Teams details
    let teams: any[] = []
    if (teamIds.length > 0) {
      const { data: teamsData } = await supabase
        .from('teams')
        .select('id, name, code, activity_id')
        .in('id', teamIds)
      teams = teamsData || []
    }

    // 4) Activities names
    const activityIds = [...new Set(teams.map(t => t.activity_id).filter(Boolean))]
    let activities: any[] = []
    if (activityIds.length > 0) {
      const { data: acts } = await supabase
        .from('activities')
        .select('id, name')
        .in('id', activityIds)
      activities = acts || []
    }

    // 5) Compose memberships with team + activity and profile extras
    const mapped: TeamMember[] = (baseMemberships || []).map((tm: any) => {
      const team = teams.find(t => t.id === tm.team_id)
      const activity = team ? activities.find(a => a.id === team.activity_id) : null
      return {
        id: tm.id,
        jersey_number: tm.jersey_number ?? undefined,
        membership_number: athleteProfile?.membership_number ?? undefined,
        medical_certificate_expiry: athleteProfile?.medical_certificate_expiry ?? undefined,
        team: team
          ? {
              id: team.id,
              name: team.name,
              code: team.code,
              activity: { name: activity?.name || 'N/A' },
            }
          : {
              id: 'unknown',
              name: 'N/D',
              code: 'N/D',
              activity: { name: 'N/D' },
            },
      }
    })

    setTeamMemberships(mapped)
    return mapped
  }

  const loadUpcomingEvents = async (teamIds: string[]) => {
    if (!teamIds || teamIds.length === 0) return

    // Next 30 days window
    const nextMonth = new Date()
    nextMonth.setDate(nextMonth.getDate() + 30)

    // Step 1: relations
    const { data: relations, error: relErr } = await supabase
      .from('event_teams')
      .select('event_id, created_at')
      .in('team_id', teamIds)
      .order('created_at', { ascending: false })

    if (relErr) {
      console.error('Error loading event relations (athlete):', relErr)
      setUpcomingEvents([])
      return
    }

    const eventIds = [...new Set((relations || []).map(r => r.event_id))]
    if (eventIds.length === 0) {
      setUpcomingEvents([])
      return
    }

    // Step 2: events by ID
    const { data: events, error: evErr } = await supabase
      .from('events')
      .select('id, title, start_time:start_date, end_time:end_date, location, description')
      .in('id', eventIds)
      .gte('start_date', new Date().toISOString())
      .lte('start_date', nextMonth.toISOString())
      .order('start_date', { ascending: true })
      .limit(10)

    if (evErr) {
      console.error('Error loading events (athlete):', evErr)
      setUpcomingEvents([])
      return
    }

    setUpcomingEvents(events || [])
  }

  const loadUnreadMessages = async (teamIds: string[]) => {
    if (!teamIds || teamIds.length === 0) return

    const orClauses: string[] = []
    orClauses.push(`profile_id.eq.${user.id}`)
    if (teamIds.length > 0) orClauses.push(`team_id.in.(${teamIds.join(',')})`)

    const { data, error } = await supabase
      .from('message_recipients')
      .select(`
        is_read,
        message:messages(
          id,
          subject,
          content,
          created_at
        )
      `)
      .eq('is_read', false)
      .or(orClauses.join(','))
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      console.error('Error loading unread messages:', error)
      setUnreadMessages([])
      return
    }

    if (data) {
      const mapped = data
        .filter((mr:any) => mr.message) // safeguard
        .map((mr:any) => ({
          ...mr.message,
          is_read: mr.is_read
        }))
      // Deduplicate by message id (avoid double counting when both team and personal recipients exist)
      const uniq = Array.from(new Map(mapped.map((m:any) => [m.id, m])).values())
      setUnreadMessages(uniq)
    }
  }

  const loadFeeInstallments = async () => {
    const { data } = await supabase
      .from('fee_installments')
      .select(`
        id,
        installment_number,
        due_date,
        amount,
        status,
        membership_fee:membership_fees(
          name,
          team:teams(name)
        )
      `)
      .eq('profile_id', user.id)
      .order('due_date', { ascending: true })
      .limit(5)

    if (data) setFeeInstallments(data)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800'
      case 'overdue':
        return 'bg-red-100 text-red-800'
      case 'due_soon':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid':
        return '✅ Pagata'
      case 'overdue':
        return '❌ Scaduta'
      case 'due_soon':
        return '⚠️ In Scadenza'
      case 'not_due':
        return '⏳ Non Scaduta'
      default:
        return status
    }
  }

  const getMedicalCertificateStatus = (expiryDate?: string) => {
    if (!expiryDate) return { text: 'Non specificato', color: 'bg-gray-100 text-gray-800' }
    
    const expiry = new Date(expiryDate)
    const today = new Date()
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysUntilExpiry < 0) {
      return { text: '❌ Scaduto', color: 'bg-red-100 text-red-800' }
    } else if (daysUntilExpiry <= 30) {
      return { text: '⚠️ In Scadenza', color: 'bg-yellow-100 text-yellow-800' }
    } else {
      return { text: '✅ Valido', color: 'bg-green-100 text-green-800' }
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
    <div className="space-y-6">
      {/* Header */}
      <div className="cs-card">
        <h2 className="text-xl font-semibold mb-4">
          Bentornato, {profile.first_name} {profile.last_name}
        </h2>
        
        {activeSeason && (
          <div className="cs-card mb-4">
            <h3 className="font-semibold">Stagione</h3>
            <p className="font-normal">{activeSeason.name}</p>
            <p className="text-secondary text-sm">
              {new Date(activeSeason.start_date).toLocaleDateString('it-IT')} - 
              {new Date(activeSeason.end_date).toLocaleDateString('it-IT')}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="cs-card">
            <div className="cs-card__meta">Squadre</div>
            <div className="text-3xl font-extrabold" style={{color:'var(--cs-accent)'}}>{teamMemberships.length}</div>
          </div>
          <div className="cs-card">
            <div className="cs-card__meta">Prossimi Eventi</div>
            <div className="text-3xl font-extrabold" style={{color:'var(--cs-success)'}}>{upcomingEvents.length}</div>
          </div>
          <div className="cs-card">
            <div className="cs-card__meta">Messaggi Non Letti</div>
            <div className="text-3xl font-extrabold" style={{color:'var(--cs-warning)'}}>{unreadMessages.length}</div>
          </div>
          <div className="cs-card">
            <div className="cs-card__meta">Rate Attive</div>
            <div className="text-3xl font-extrabold" style={{color:'var(--cs-primary)'}}>{feeInstallments.length}</div>
          </div>
        </div>
        <div className="cs-card mt-4">
    <h3 className="font-semibold mb-3">La tua maglia</h3>
  </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Memberships */}
        <div className="cs-card">
          <h3 className="font-semibold mb-4">Le Tue Squadre</h3>
          {teamMemberships.length === 0 ? (
            <p className="text-secondary text-sm">Non sei iscritto a nessuna squadra</p>
          ) : (
            <div className="cs-list">
              {teamMemberships.map((membership) => {
                const certStatus = getMedicalCertificateStatus(membership.medical_certificate_expiry)
                return (
                  <div key={membership.id} className="cs-list-item">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium">{membership.team.name}</div>
                        <div className="text-sm text-secondary">Attività: {membership.team.activity?.name}</div>
                      </div>
                      {/* Status moved near expiry date below */}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {membership.jersey_number && (
                        <div>
                          <span className="text-secondary">Maglia:</span>
                          <span className="ml-1 font-medium">#{membership.jersey_number}</span>
                        </div>
                      )}
                      {membership.membership_number && (
                        <div>
                          <span className="text-secondary">Tessera:</span>
                          <span className="ml-1 font-medium">{membership.membership_number}</span>
                        </div>
                      )}
                      {membership.medical_certificate_expiry && (
                        <div className="col-span-2 flex items-center flex-wrap gap-2">
                          <div>
                            <span className="text-secondary">Certificato scade:</span>
                            <span className="ml-1 font-medium">
                              {new Date(membership.medical_certificate_expiry).toLocaleDateString('it-IT')}
                            </span>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded ${certStatus.color}`}>
                            {certStatus.text}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
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
            <div className="cs-list max-h-80 overflow-y-auto">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="cs-list-item cursor-pointer" onClick={() => setSelectedEvent(event)}>
                  <div className="font-medium">{event.title}</div>
                  <div className="text-sm">
                    {new Date(event.start_time).toLocaleDateString('it-IT')} alle{' '}
                    {new Date(event.start_time).toLocaleTimeString('it-IT', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                  {event.location && (<div className="text-sm text-secondary">📍 {event.location}</div>)}
                  {event.description && (<div className="text-xs text-secondary mt-1 line-clamp-2">{event.description}</div>)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Messages & Fees */}
        <div className="space-y-6">
          {/* Unread Messages */}
          <div className="cs-card">
            <h3 className="font-semibold mb-4">Messaggi Non Letti</h3>
            {unreadMessages.length === 0 ? (
              <p className="text-secondary text-sm">Nessun messaggio non letto</p>
            ) : (
              <div className="cs-list">
                {unreadMessages.slice(0, 3).map((message) => (
                  <div key={message.id} className="cs-list-item cursor-pointer" onClick={() => setSelectedMessage(message)}>
                    <div className="font-medium text-sm">{message.subject}</div>
                    <div className="text-xs text-secondary truncate">
                      {message.content.length > 100 
                        ? `${message.content.substring(0, 100)}...` 
                        : message.content}
                    </div>
                    <div className="text-xs text-secondary">
                      {new Date(message.created_at).toLocaleDateString('it-IT')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fee Installments */}
          <div className="cs-card">
            <h3 className="font-semibold mb-4">Quote Associative</h3>
            {feeInstallments.length === 0 ? (
              <p className="text-secondary text-sm">Nessuna quota associativa</p>
            ) : (
              <div className="cs-list">
                {feeInstallments.slice(0, 3).map((installment) => (
                  <div key={installment.id} className="cs-list-item">
                    <div className="text-sm">
                      <div className="font-medium">
                        {installment.membership_fee.name} - Rata {installment.installment_number}
                      </div>
                      <div className="text-secondary">
                        {installment.membership_fee.team.name}
                      </div>
                      <div className="text-secondary">
                        Scadenza: {new Date(installment.due_date).toLocaleDateString('it-IT')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">€{installment.amount}</div>
                      <span className={`cs-badge ${installment.status==='paid' ? 'cs-badge--success' : installment.status==='overdue' ? 'cs-badge--danger' : 'cs-badge--warning'}`}>{getStatusText(installment.status)}</span>
                    </div>
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
            <div>📅 {new Date(selectedEvent.start_time).toLocaleString('it-IT')}</div>
            {selectedEvent.location && <div>📍 {selectedEvent.location}</div>}
            {selectedEvent.description && <div className="text-secondary">{selectedEvent.description}</div>}
          </div>
        </DetailsDrawer>
      )}
      {selectedMessage && (
        <DetailsDrawer open={true} title="Dettaglio Messaggio" onClose={() => setSelectedMessage(null)}>
          <div className="space-y-3 text-sm">
            <div className="font-medium">{(messageDetail?.subject) || selectedMessage.subject}</div>
            <div className="text-xs text-secondary">{new Date(selectedMessage.created_at).toLocaleString('it-IT')}</div>
            <div className="whitespace-pre-wrap">{(messageDetail?.content) || selectedMessage.content}</div>
            {messageDetail?.created_by_profile && (
              <div>✍️ {messageDetail.created_by_profile.first_name} {messageDetail.created_by_profile.last_name}</div>
            )}
            {messageDetail?.message_recipients && messageDetail.message_recipients.length > 0 && (
              <div>
                <div className="text-xs text-secondary mb-1">Destinatari</div>
                <div className="flex flex-wrap gap-1">
                  {messageDetail.message_recipients.map((mr: any) => (
                    <span key={mr.id} className="cs-badge cs-badge--neutral">
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
