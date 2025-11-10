'use client'

import { useState, useEffect, useRef } from 'react'
import { useNextStep } from 'nextstepjs'
import { createClient } from '@/lib/supabase/client'
import DetailsDrawer from '@/components/shared/DetailsDrawer'
import EventDetailModal from '@/components/shared/EventDetailModal'
import MessageDetailModal from '@/components/shared/MessageDetailModal'
import TeamDetailModal, { TeamDetailData } from '@/components/shared/TeamDetailModal'
import UpcomingEventsPanel from '@/components/shared/UpcomingEventsPanel'
import LatestMessagesPanel from '@/components/shared/LatestMessagesPanel'

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
  const { startNextStep } = useNextStep()
  const [teamMemberships, setTeamMemberships] = useState<TeamMember[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([])
  const [unreadMessages, setUnreadMessages] = useState<Message[]>([])
  const [feeInstallments, setFeeInstallments] = useState<FeeInstallment[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSeason, setActiveSeason] = useState<any>(null)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [messageDetail, setMessageDetail] = useState<any>(null)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [teamDetailData, setTeamDetailData] = useState<TeamDetailData | null>(null)
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

  // Load team details when team is selected
  useEffect(() => {
    if (selectedTeamId) {
      loadTeamDetail(selectedTeamId)
    } else {
      setTeamDetailData(null)
    }
  }, [selectedTeamId])

  useEffect(() => {
    loadAthleteData()
  }, [])

  // Ricarica intelligente quando la tab torna visibile (solo se necessario)
  const lastLoadTimeRef = useRef<number>(0)
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (debounceTimer) clearTimeout(debounceTimer)

      debounceTimer = setTimeout(() => {
        // Solo se i dati sono vecchi (> 2 minuti)
        const now = Date.now()
        const timeSinceLastLoad = now - lastLoadTimeRef.current
        if (timeSinceLastLoad > 120000) { // 2 minuti
          loadAthleteData()
          lastLoadTimeRef.current = now
        }
      }, 1000) // Debounce di 1 secondo
    }

    window.addEventListener('visibilitychange', onVisible)
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      window.removeEventListener('visibilitychange', onVisible)
    }
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
      lastLoadTimeRef.current = Date.now()
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
          created_at,
          created_by,
          created_by_profile:profiles!messages_created_by_fkey(first_name, last_name)
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
        .map((mr:any) => {
          const msg = mr.message
          const from = msg.created_by_profile
            ? `${msg.created_by_profile.first_name || ''} ${msg.created_by_profile.last_name || ''}`.trim()
            : undefined
          return {
            ...msg,
            is_read: mr.is_read,
            from
          }
        })
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

  const loadTeamDetail = async (teamId: string) => {
    try {
      // 1. Team basic info
      const { data: teamData } = await supabase
        .from('teams')
        .select('name, code, activity_id, activities(name)')
        .eq('id', teamId)
        .single()

      if (!teamData) return

      // 2. Training schedules with gyms
      const { data: schedules } = await supabase
        .from('team_training_schedules')
        .select('day_of_week, start_time, end_time, gym_id, gyms(name, city)')
        .eq('team_id', teamId)
        .eq('is_active', true)
        .order('day_of_week, start_time')

      // 3. Coaches (without join)
      const { data: coachesData, error: coachesError } = await supabase
        .from('team_coaches')
        .select('coach_id, role')
        .eq('team_id', teamId)

      console.log('Athlete loading coaches:', { coachesData, coachesError, teamId })

      // 4. Athletes (without join)
      const { data: membersData } = await supabase
        .from('team_members')
        .select('profile_id, jersey_number')
        .eq('team_id', teamId)
        .order('jersey_number')

      // 5. Load profiles separately to avoid RLS recursion
      const coachIds = coachesData?.map(c => c.coach_id).filter(Boolean) || []
      const memberIds = membersData?.map(m => m.profile_id).filter(Boolean) || []
      const allProfileIds = [...coachIds, ...memberIds]

      let profilesMap = new Map<string, any>()
      if (allProfileIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', allProfileIds)

        console.log('Athlete loading profiles:', { allProfileIds, profilesData, profilesError })

        profilesData?.forEach(p => profilesMap.set(p.id, p))
      }

      // Build TeamDetailData
      const detail: TeamDetailData = {
        name: teamData.name,
        code: teamData.code,
        activity: teamData.activities ? { name: teamData.activities.name } : undefined,
        training_schedules: schedules?.map(s => ({
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          gym: {
            name: s.gyms?.name || 'N/D',
            city: s.gyms?.city
          }
        })) || [],
        coaches: coachesData?.map(c => {
          const profile = profilesMap.get(c.coach_id)
          return {
            id: c.coach_id,
            first_name: profile?.first_name || '',
            last_name: profile?.last_name || '',
            role: c.role
          }
        }) || [],
        athletes: membersData?.map(m => {
          const profile = profilesMap.get(m.profile_id)
          return {
            id: m.profile_id,
            first_name: profile?.first_name || '',
            last_name: profile?.last_name || '',
            jersey_number: m.jersey_number
          }
        }) || []
      }

      setTeamDetailData(detail)
    } catch (error) {
      console.error('Error loading team details:', error)
      setTeamDetailData(null)
    }
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
      <div className="cs-card cs-card--primary">
        <div className="flex items-center justify-between mb-4">
          <h2 id="athlete-welcome" className="text-xl font-semibold">
            Bentornato, {profile.first_name} {profile.last_name}
          </h2>
          <button
            id="athlete-start-tour"
            className="cs-btn cs-btn--ghost"
            onClick={() => startNextStep('athlete')}
          >
            Guida
          </button>
        </div>
        
        {activeSeason && (
          <div className="cs-card cs-card--primary mb-4">
            <h3 className="font-semibold">Stagione</h3>
            <p className="font-normal">{activeSeason.name}</p>
            <p className="text-secondary text-sm">
              {new Date(activeSeason.start_date).toLocaleDateString('it-IT')} - 
              {new Date(activeSeason.end_date).toLocaleDateString('it-IT')}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="cs-card cs-card--primary">
            <div className="cs-card__meta">Squadre</div>
            <div className="text-3xl font-extrabold" style={{color:'var(--cs-accent)'}}>{teamMemberships.length}</div>
          </div>
          <div className="cs-card cs-card--primary">
            <div className="cs-card__meta">Prossimi Eventi</div>
            <div className="text-3xl font-extrabold" style={{color:'var(--cs-success)'}}>{upcomingEvents.length}</div>
          </div>
          <div className="cs-card cs-card--primary">
            <div className="cs-card__meta">Ultimi Messaggi</div>
            <div className="text-3xl font-extrabold" style={{color:'var(--cs-warning)'}}>{unreadMessages.length}</div>
          </div>
          <div className="cs-card cs-card--primary">
            <div className="cs-card__meta">Rate Attive</div>
            <div className="text-3xl font-extrabold" style={{color:'var(--cs-primary)'}}>{feeInstallments.length}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Memberships */}
        <div className="cs-card cs-card--primary">
          <h3 id="athlete-teams" className="font-semibold mb-4">Le Tue Squadre</h3>
          {teamMemberships.length === 0 ? (
            <p className="text-secondary text-sm">Non sei iscritto a nessuna squadra</p>
          ) : (
            <div className="cs-list">
              {teamMemberships.map((membership) => {
                const certStatus = getMedicalCertificateStatus(membership.medical_certificate_expiry)
                return (
                  <div
                    key={membership.id}
                    className="cs-list-item cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedTeamId(membership.team.id)}
                  >
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
        {/* Upcoming Events clean */}
        <UpcomingEventsPanel
          items={upcomingEvents.map(ev => ({
            id: ev.id,
            title: ev.title,
            start: new Date(ev.start_time),
            end: new Date(ev.end_time),
            location: ev.location || null,
            kind: ev.event_kind ? ({training:'Allenamento', match:'Partita', meeting:'Riunione', other:'Altro'} as any)[(ev as any).event_kind] : null,
            subtitle: ev.description || null,
          }))}
          viewAllHref="/athlete/calendar"
          onDetail={(id) => { const e = upcomingEvents.find(x=>x.id===id); if (e) setSelectedEvent(e as any) }}
        />

        {/* Messages & Fees */}
        <div className="space-y-6">
          {/* Unread Messages clean */}
          <LatestMessagesPanel
            items={unreadMessages.slice(0,3).map(m => ({
              id: m.id,
              subject: m.subject,
              preview: m.content,
              created_at: m.created_at ? new Date(m.created_at) : undefined,
              from: (m as any).from || (m.created_by_profile ? `${m.created_by_profile.first_name || ''} ${m.created_by_profile.last_name || ''}`.trim() : undefined),
            }))}
            viewAllHref="/athlete/messages"
            onDetail={(id)=>{ const m = unreadMessages.find(x=>x.id===id); if (m) setSelectedMessage(m as any) }}
          />

          {/* Fee Installments */}
          <div className="cs-card cs-card--primary">
            <h3 id="athlete-fees" className="font-semibold mb-4">Quote Associative</h3>
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
      {/* Modals dettagli */}
      {selectedEvent && (
        <EventDetailModal
          open={true}
          onClose={() => setSelectedEvent(null)}
          data={{
            title: selectedEvent.title,
            event_kind: (selectedEvent as any).event_kind,
            start_date: (selectedEvent as any).start_time,
            end_date: (selectedEvent as any).end_time,
            location: selectedEvent.location || undefined,
            description: selectedEvent.description || undefined,
          }}
        />
      )}
      {selectedMessage && (
        <MessageDetailModal
          open={true}
          onClose={() => setSelectedMessage(null)}
          data={{
            subject: messageDetail?.subject || selectedMessage.subject,
            content: messageDetail?.content || selectedMessage.content,
            created_at: messageDetail?.created_at || selectedMessage.created_at,
            created_by_profile: messageDetail?.created_by_profile || (selectedMessage as any).created_by_profile || null,
            message_recipients: (messageDetail?.message_recipients as any) || (selectedMessage as any).message_recipients || [],
            attachments: (messageDetail?.attachments || (selectedMessage as any).attachments || []).map((a:any)=>({ file_name: a.file_name, download_url: a.download_url }))
          }}
        />
      )}
      {selectedTeamId && (
        <TeamDetailModal
          open={true}
          onClose={() => setSelectedTeamId(null)}
          data={teamDetailData}
        />
      )}
    </div>
  )
}
