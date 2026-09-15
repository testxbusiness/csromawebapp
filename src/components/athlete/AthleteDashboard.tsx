'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import DetailsDrawer from '@/components/shared/DetailsDrawer'
import EventDetailModal from '@/components/shared/EventDetailModal'
import MessageDetailModal, { type MessageReadState } from '@/components/shared/MessageDetailModal'
import TeamDetailModal, { TeamDetailData } from '@/components/shared/TeamDetailModal'
import { EventKindBadge, FeedbackState, ListRow, LoadingState, Panel, StatusBadge } from '@/components/ui'
import AttendanceControl from './AttendanceControl'
import { MessagePreviewRow } from './MessagePreviewRow'
import { MembershipRow } from './MembershipRow'
import { feeStatusLabel, selectMostUrgentFee } from '@/lib/athlete/fee-preview'
import { hasDashboardData, isDashboardDataCurrent, type DashboardStatus } from '@/lib/athlete/dashboard-state'
import { appendSubjectProfile, SUBJECT_CONTEXT_CHANGED_EVENT, type SubjectContextChangedDetail, useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { useTeamContext } from '@/context/TeamContext'
import DelegatedAccessDenied from './DelegatedAccessDenied'
import { useAuth } from '@/hooks/useAuth'
import type { AttendanceAvailabilityContract } from '@/types/attendance'

interface User {
  id: string
  email?: string
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
  event_kind?: 'training' | 'match' | 'meeting' | 'other'
  gym_id?: string | null
  requires_confirmation?: boolean
  attendance_mode?: 'rsvp' | 'absence_only'
  confirmation_deadline?: string | null
  my_attendance?: { status?: 'going' | 'maybe' | 'declined'; responded_at?: string | null; is_early_absence?: boolean } | null
  teams?: Array<{ id: string; name: string; code: string }>
  team_ids?: string[]
  attendance_availability?: AttendanceAvailabilityContract | null
}

interface ChampionshipMatch {
  id: string
  /** Present only when the existing payload explicitly links this match to an event. */
  event_id?: string | null
  match_day?: number | null
  match_date?: string | null
  start_time?: string | null
  location_text?: string | null
  home_club_team?: { id: string; name: string; code?: string; team_id?: string } | null
  away_club_team?: { id: string; name: string; code?: string; team_id?: string } | null
  team?: { id: string; name: string; code?: string } | null
  opponent?: { id: string; name: string; code?: string } | null
  is_home?: boolean
  team_ids?: string[]
}

interface Message {
  id: string
  subject: string
  content: string
  created_at: string
  is_read: boolean
  read_state?: MessageReadState
  created_by_profile?: { first_name?: string | null; last_name?: string | null }
  teams?: Array<{ id: string; name: string; code?: string }>
  team_ids?: string[]
}

interface FeeInstallment {
  id: string
  installment_number: number
  due_date: string
  amount: number
  status: 'not_due' | 'due_soon' | 'overdue' | 'paid' | 'partially_paid'
  membership_fee: {
    name: string
    description?: string | null
    team: {
      id?: string
      name: string
      code?: string
      activity?: { name: string } | null
    }
  }
}

interface AthleteDashboardProps {
  user: User
  profile: Profile
  delegatedView?: boolean
}

function firstRelation<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined
}

function SectionHeading({ title, href }: { title: string; href?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-base font-semibold text-[color:var(--cs-text)]">{title}</h3>
      {href && <Link href={href} className="cs-btn cs-btn--ghost cs-btn--sm">Vedi tutti</Link>}
    </div>
  )
}

function formatEventTime(value: string) {
  return new Date(value).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatEventDate(value: string) {
  return new Date(value).toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatFeeAmount(value: number | null | undefined): string {
  return value == null ? '—' : new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value)
}

export function formatAgendaDateTime(value: string, now = new Date()) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Data non disponibile'

  const dateOnly = (item: Date) => new Date(item.getFullYear(), item.getMonth(), item.getDate()).getTime()
  const dayDelta = Math.round((dateOnly(date) - dateOnly(now)) / 86_400_000)
  const dayLabel = dayDelta === 0
    ? 'Oggi'
    : dayDelta === 1
      ? 'Domani'
      : date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })

  return `${dayLabel} · ${date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`
}

export type FeaturedEventState = 'upcoming' | 'in_progress' | 'ended' | 'unknown'

/** Classifies the event selected by the existing dashboard contract. */
export function getFeaturedEventState(event: Pick<Event, 'start_time' | 'end_time'>, now = new Date()): FeaturedEventState {
  const start = new Date(event.start_time).getTime()
  const end = new Date(event.end_time).getTime()
  const timestamp = now.getTime()

  if (![start, end, timestamp].every(Number.isFinite) || start >= end) return 'unknown'
  if (timestamp < start) return 'upcoming'
  if (timestamp < end) return 'in_progress'
  return 'ended'
}

/**
 * Hide the championship summary only when the payload proves it is the same
 * match as the featured event. Title/date/team comparisons are intentionally
 * excluded so a friendly match cannot hide useful championship information.
 */
export function shouldShowNextChampionshipMatchSummary(
  firstVisibleEvent: Pick<Event, 'id' | 'event_kind'> | undefined,
  championshipMatch: Pick<ChampionshipMatch, 'event_id'> | null,
): boolean {
  if (!championshipMatch) return false
  if (!firstVisibleEvent || firstVisibleEvent.event_kind !== 'match') return true
  return championshipMatch.event_id !== firstVisibleEvent.id
}

function featuredEventStateLabel(state: FeaturedEventState) {
  switch (state) {
    case 'upcoming': return 'Prossimo'
    case 'in_progress': return 'In corso'
    case 'ended': return 'Terminato'
    default: return 'Stato non disponibile'
  }
}

export default function AthleteDashboard({ user, profile, delegatedView = false }: AthleteDashboardProps) {
  const { selectedProfileId, selectedProfile } = useAccessibleProfiles()
  const { selectedTeamId: activeTeamId, setTeams, resetTeam } = useTeamContext()
  const { role: accountRole, loading: authLoading, profileLoading } = useAuth()
  const [teamMemberships, setTeamMemberships] = useState<TeamMember[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([])
  const [unreadMessages, setUnreadMessages] = useState<Message[]>([])
  const [unreadMessageCount, setUnreadMessageCount] = useState<number | null>(null)
  const [feeInstallments, setFeeInstallments] = useState<FeeInstallment[]>([])
  const [nextChampionshipMatch, setNextChampionshipMatch] = useState<ChampionshipMatch | null>(null)
  const [dashboardStatus, setDashboardStatus] = useState<DashboardStatus>('loading')
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  const [dataSubjectKey, setDataSubjectKey] = useState<string | null>(null)
  const [isOffline, setIsOffline] = useState(false)
  const [activeSeason, setActiveSeason] = useState<any>(null)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [messageDetail, setMessageDetail] = useState<any>(null)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [teamDetailData, setTeamDetailData] = useState<TeamDetailData | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const supabase = useMemo(() => createClient(), [])
  const dashboardRequestRef = useRef<AbortController | null>(null)
  const attendanceRequestRef = useRef<AbortController | null>(null)
  const lastSubjectKeyRef = useRef<string | null>(null)
  const hasLoadedDashboardRef = useRef(false)
  const subjectKey = selectedProfileId ?? profile?.id ?? null

  useEffect(() => {
    const handleSubjectChange = (event: globalThis.Event) => {
      const nextSubject = (event as CustomEvent<SubjectContextChangedDetail>).detail?.subjectProfileId ?? profile?.id ?? null
      lastSubjectKeyRef.current = nextSubject
      dashboardRequestRef.current?.abort()
      attendanceRequestRef.current?.abort()
      hasLoadedDashboardRef.current = false
      setDataSubjectKey(null)
      setActiveSeason(null)
      setTeamMemberships([])
      setUpcomingEvents([])
      setUnreadMessages([])
      setUnreadMessageCount(null)
      setFeeInstallments([])
      setNextChampionshipMatch(null)
      setSelectedEvent(null)
      setSelectedMessage(null)
      setMessageDetail(null)
      setTeamDetailData(null)
      setSelectedTeamId(null)
      setDashboardError(null)
      setAccessDenied(false)
      setDashboardStatus('loading')
    }
    window.addEventListener(SUBJECT_CONTEXT_CHANGED_EVENT, handleSubjectChange)
    return () => window.removeEventListener(SUBJECT_CONTEXT_CHANGED_EVENT, handleSubjectChange)
  }, [profile?.id])

  const persistEventAttendance = async (eventId: string, status: 'going' | 'maybe' | 'declined') => {
    const requestSubjectKey = subjectKey
    const controller = new AbortController()
    attendanceRequestRef.current?.abort()
    attendanceRequestRef.current = controller

    try {
      const response = await fetch(appendSubjectProfile('/api/athlete/events/attendance', selectedProfileId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, status }),
        signal: controller.signal,
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || 'Impossibile salvare la risposta')

      if (controller.signal.aborted || lastSubjectKeyRef.current !== requestSubjectKey) return

      const respondedAt = new Date().toISOString()
      setSelectedEvent((current) => current?.id === eventId ? {
        ...current,
        my_attendance: { status, responded_at: respondedAt },
      } : current)
      setUpcomingEvents((current) => current.map((event) => event.id === eventId
        ? { ...event, my_attendance: { status, responded_at: respondedAt } }
        : event
      ))
      void loadAthleteData()
    } catch (error) {
      if (controller.signal.aborted) return
      throw error
    } finally {
      if (attendanceRequestRef.current === controller) attendanceRequestRef.current = null
    }
  }

  const saveEventAttendance = async (status: 'going' | 'maybe' | 'declined') => {
    if (!selectedEvent) return
    await persistEventAttendance(selectedEvent.id, status)
  }

  const mutateEarlyAbsence = async (eventId: string, revoke = false, note?: string) => {
    if (!navigator.onLine) throw new Error('Sei offline: l’assenza non può essere salvata')
    const response = await fetch(appendSubjectProfile('/api/athlete/events/early-absence', selectedProfileId), { method: revoke ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_ids: [eventId], ...(revoke ? {} : { note }) }) })
    const result = await response.json().catch(() => null) as { error?: string } | null
    if (!response.ok) throw new Error(result?.error || 'Impossibile aggiornare l’assenza')
    if (lastSubjectKeyRef.current !== subjectKey) return
    const updateEvent = (event: Event): Event => {
      if (event.id !== eventId) return event
      const availability = event.attendance_availability
      if (!availability) return event
      const isNext = availability.next_event?.id === eventId
      return {
        ...event,
        my_attendance: revoke
          ? null
          : { status: 'declined', responded_at: new Date().toISOString(), is_early_absence: true },
        attendance_availability: {
          ...availability,
          can_respond_now: revoke ? isNext : false,
          can_report_early_absence: !revoke,
          can_revoke_early_absence: revoke,
          actions: {
            respond: revoke ? isNext : false,
            report_early_absence: !revoke,
            revoke_early_absence: revoke,
          },
          closure_reason: revoke ? (isNext ? null : 'not_next_event') : 'already_early_absence',
        },
      }
    }
    setSelectedEvent((current) => current ? updateEvent(current) : current)
    setUpcomingEvents((current) => current.map(updateEvent))
    void loadAthleteData()
  }

  // Enrich selected message on open
  useEffect(() => {
    const controller = new AbortController()
    const loadDetail = async () => {
      if (!selectedMessage) { return }
      try {
        const requestSubjectKey = subjectKey
        const res = await fetch(appendSubjectProfile(`/api/athlete/messages?view=full&id=${selectedMessage.id}`, selectedProfileId), { signal: controller.signal })
        const json = await res.json()
        if (!controller.signal.aborted && lastSubjectKeyRef.current === requestSubjectKey && res.ok && json.messages && json.messages.length) {
          setMessageDetail(json.messages[0])
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) return
      }
    }
    void loadDetail()
    return () => controller.abort()
  }, [selectedMessage, selectedProfileId, subjectKey])

  const nextRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadAthleteData = useCallback(async () => {
    if (!user?.id || !profile?.id || !accountRole) {
      dashboardRequestRef.current?.abort()
      setDashboardStatus('loading')
      return
    }

    if (authLoading || profileLoading) {
      setDashboardStatus('loading')
      return
    }

    const subjectChanged = lastSubjectKeyRef.current !== subjectKey
    if (subjectChanged) {
      lastSubjectKeyRef.current = subjectKey
      hasLoadedDashboardRef.current = false
      setDataSubjectKey(null)
      setActiveSeason(null)
      setTeamMemberships([])
      setUpcomingEvents([])
      setNextChampionshipMatch(null)
      setUnreadMessages([])
      setUnreadMessageCount(null)
      setFeeInstallments([])
      resetTeam()
    }

    const delegatedPermissions = selectedProfile?.relationship.permissions
    const canAccessDelegatedDashboard = Boolean(
      delegatedPermissions?.view_schedule ||
      delegatedPermissions?.view_payments ||
      delegatedPermissions?.receive_messages
    )
    if (accountRole === 'family_member' && (!selectedProfile || !canAccessDelegatedDashboard)) {
      setAccessDenied(true)
      setDashboardStatus('denied')
      return
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOffline(true)
      setDashboardStatus('offline')
      return
    }

    setDashboardStatus(hasLoadedDashboardRef.current && !subjectChanged ? 'refreshing' : 'loading')
    setDashboardError(null)
    setAccessDenied(false)
    dashboardRequestRef.current?.abort()
    const controller = new AbortController()
    dashboardRequestRef.current = controller

    try {
      const response = await fetch(appendSubjectProfile('/api/athlete/dashboard', selectedProfileId), {
        signal: controller.signal,
      })
      if (!response.ok) {
        if (response.status === 403) {
          setAccessDenied(true)
          setDashboardStatus('denied')
          return
        }
        if (response.status === 401) {
          setDashboardError('La sessione non è più valida. Accedi di nuovo per continuare.')
        } else {
          setDashboardError('Non è stato possibile caricare i dati della dashboard.')
          console.error('Error loading athlete dashboard:', response.statusText)
        }
        setDashboardStatus('error')
        return
      }

      const result = await response.json()
      if (controller.signal.aborted || lastSubjectKeyRef.current !== subjectKey) return
      setActiveSeason(result.activeSeason)
      setTeamMemberships(result.teamMemberships || [])
      setUpcomingEvents(result.upcomingEvents || [])
      setNextChampionshipMatch(result.nextChampionshipMatch || null)
      setUnreadMessages(result.unreadMessages || [])
      setUnreadMessageCount(typeof result.unreadMessageCount === 'number' ? result.unreadMessageCount : null)
      setFeeInstallments(result.feeInstallments || [])
      setTeams((result.teams || []).map((team: { id: string; name: string; code?: string; activity?: { name?: string } | null }) => ({
        id: team.id,
        name: team.name,
        code: team.code,
        activity: team.activity?.name ?? null,
      })))
      setDataSubjectKey(subjectKey)
      hasLoadedDashboardRef.current = true
      setIsOffline(false)
      setDashboardStatus('success')
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      console.error('Error loading athlete data:', e)
      setDashboardError('Controlla la connessione e riprova.')
      setDashboardStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error')
      setIsOffline(typeof navigator !== 'undefined' && !navigator.onLine)
    } finally {
      if (controller.signal.aborted) return
    }
  }, [accountRole, authLoading, profile?.id, profileLoading, resetTeam, selectedProfile, selectedProfileId, setTeams, subjectKey, user?.id])

  useEffect(() => {
    return () => {
      dashboardRequestRef.current?.abort()
    }
  }, [])

  /* Legacy per-widget loaders were superseded by /api/athlete/dashboard. */
  /*
  const loadActiveSeason = useCallback(async () => {
    const { data } = await supabase
      .from('seasons')
      .select('*')
      .eq('is_active', true)
      .single()
    if (data) setActiveSeason(data)
  }, [supabase])

  const loadTeamMemberships = useCallback(async () => {
    // 1) Base memberships (no joins) — avoids PostgREST relationship cache errors
    const { data: baseMemberships, error: tmError } = await supabase
      .from('team_members')
      .select('id, team_id, jersey_number')
      .eq('profile_id', profile.id)

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
  }, [profile?.athlete_profile, profile.id, supabase])

  const loadUpcomingEvents = useCallback(async (teamIds: string[]) => {
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
  }, [supabase])

  const loadUnreadMessages = useCallback(async (teamIds: string[]) => {
    if (!teamIds || teamIds.length === 0) return

    const orClauses: string[] = []
    orClauses.push(`profile_id.eq.${profile.id}`)
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
  }, [profile.id, supabase])

  const loadFeeInstallments = useCallback(async () => {
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
      .eq('profile_id', profile.id)
      .order('due_date', { ascending: true })
      .limit(5)

    if (data) setFeeInstallments(data as unknown as FeeInstallment[])
  }, [profile.id, supabase])

  */

  const loadTeamDetail = useCallback(async (teamId: string) => {
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
        activity: firstRelation(teamData.activities) ? { name: firstRelation(teamData.activities)!.name } : undefined,
        training_schedules: schedules?.map(s => ({
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          gym: {
            name: firstRelation(s.gyms)?.name || 'N/D',
            city: firstRelation(s.gyms)?.city
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
  }, [supabase])

  // Effects that depend on dashboard callbacks are declared after them so the
  // callbacks are initialized before React evaluates their dependency arrays.
  useEffect(() => {
    if (selectedTeamId) {
      void loadTeamDetail(selectedTeamId)
    } else {
      setTeamDetailData(null)
    }
  }, [loadTeamDetail, selectedTeamId])

  useEffect(() => {
    void loadAthleteData()
  }, [loadAthleteData])

  useEffect(() => {
    const onOffline = () => {
      setIsOffline(true)
      setDashboardStatus('offline')
    }
    const onOnline = () => {
      setIsOffline(false)
      void loadAthleteData()
    }
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [loadAthleteData])

  // Ricarica quando la tab torna visibile; il server resta la fonte dell'evento attivo.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      void loadAthleteData()
    }

    window.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('visibilitychange', onVisible)
    }
  }, [loadAthleteData])

  useEffect(() => {
    if (nextRefreshTimerRef.current) clearTimeout(nextRefreshTimerRef.current)
    const nextAt = upcomingEvents
      .map((event) => event.attendance_availability?.next_recalculation_at)
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime())
      .filter((value) => Number.isFinite(value) && value > Date.now())
      .sort((a, b) => a - b)[0]
    if (!nextAt) return
    nextRefreshTimerRef.current = setTimeout(() => void loadAthleteData(), Math.max(0, nextAt - Date.now() + 25))
    return () => {
      if (nextRefreshTimerRef.current) clearTimeout(nextRefreshTimerRef.current)
      nextRefreshTimerRef.current = null
    }
  }, [loadAthleteData, upcomingEvents])

  const isDelegatedProfile = (accountRole === 'family_member' || delegatedView) && Boolean(selectedProfileId)
  const isFamilyDashboard = delegatedView || isDelegatedProfile
  const permissions = isDelegatedProfile ? selectedProfile?.relationship.permissions : null
  const canViewSchedule = !isDelegatedProfile || permissions?.view_schedule === true
  const canReceiveMessages = !isDelegatedProfile || permissions?.receive_messages === true
  const canViewPayments = !isDelegatedProfile || permissions?.view_payments === true
  const mostUrgentFee = selectMostUrgentFee(feeInstallments)

  useEffect(() => {
    if (!canViewSchedule) {
      setSelectedEvent(null)
      setSelectedTeamId(null)
    }
    if (!canReceiveMessages) {
      setSelectedMessage(null)
      setMessageDetail(null)
    }
  }, [canReceiveMessages, canViewSchedule])

  const dashboardHasData = hasDashboardData({
    activeSeason,
    teamCount: teamMemberships.length,
    eventCount: upcomingEvents.length,
    messageCount: unreadMessages.length,
    feeCount: feeInstallments.length,
    hasNextMatch: Boolean(nextChampionshipMatch),
  })
  const subjectDataIsCurrent = isDashboardDataCurrent(dataSubjectKey, subjectKey)
  const selectedTeamMatches = (teamIds?: string[]) => !activeTeamId || Boolean(teamIds?.includes(activeTeamId))
  const visibleEvents = upcomingEvents.filter((event) => selectedTeamMatches(event.team_ids || event.teams?.map((team) => team.id)))
  const visibleMessages = unreadMessages.filter((message) => selectedTeamMatches(message.team_ids || message.teams?.map((team) => team.id)))
  const visibleFees = feeInstallments.filter((fee) => selectedTeamMatches(fee.membership_fee.team.id ? [fee.membership_fee.team.id] : undefined))
  const visibleMemberships = teamMemberships.filter((membership) => selectedTeamMatches([membership.team.id]))
  const visibleMatch = nextChampionshipMatch && selectedTeamMatches(nextChampionshipMatch.team_ids) ? nextChampionshipMatch : null
  const showNextChampionshipMatch = shouldShowNextChampionshipMatchSummary(visibleEvents[0], visibleMatch)
  const mostUrgentVisibleFee = selectMostUrgentFee(visibleFees)
    ?? (visibleFees.length > 0 && visibleFees.every((fee) => fee.status === 'paid') ? visibleFees[0] : undefined)
  const messageTitleCount = activeTeamId ? visibleMessages.length : unreadMessageCount ?? unreadMessages.length

  if (accessDenied || dashboardStatus === 'denied') return <DelegatedAccessDenied section="la dashboard" profileName={selectedProfile ? `${selectedProfile.profile.first_name} ${selectedProfile.profile.last_name}` : undefined} />
  if (dashboardStatus === 'offline' && !dashboardHasData) {
    return <FeedbackState
      variant="offline"
      title="Dashboard non disponibile offline"
      description="Riconnettiti a internet per caricare i dati della dashboard."
      className="mx-auto max-w-2xl px-5 py-12 text-center"
      action={<button type="button" className="cs-btn cs-btn--primary" onClick={() => void loadAthleteData()}>Riprova</button>}
    />
  }
  if (!subjectDataIsCurrent || dashboardStatus === 'loading') {
    return <LoadingState label="Un attimo, si scende in campo…" />
  }
  if (dashboardStatus === 'error') {
    return <FeedbackState
      variant="error"
      title="Dashboard non disponibile"
      description={dashboardError || 'Non è stato possibile caricare i dati. Riprova tra poco.'}
      className="mx-auto max-w-2xl px-5 py-12 text-center"
      action={<button type="button" className="cs-btn cs-btn--primary" onClick={() => void loadAthleteData()}>Riprova</button>}
    />
  }

  return (
    <div
      className="cs-athlete-dashboard mx-auto space-y-5"
      data-dashboard-context={isFamilyDashboard ? 'family' : 'personal'}
    >
      {dashboardStatus === 'refreshing' && <FeedbackState variant="refreshing" description="Stai visualizzando i dati già caricati mentre controlliamo gli aggiornamenti." />}
      {isOffline && <FeedbackState
        variant="offline"
        title={dashboardHasData ? 'Connessione assente' : 'Dashboard non disponibile offline'}
        description={dashboardHasData ? 'Stai visualizzando gli ultimi dati caricati per questo profilo.' : 'Riconnettiti a internet per caricare i dati della dashboard.'}
        className="px-4 py-3"
      />}
      <header className="cs-athlete-dashboard__intro space-y-1 border-b border-[color:var(--cs-border)] pb-4">
        {isFamilyDashboard ? <p className="cs-eyebrow">Area familiare</p> : null}
        <h2 id="athlete-welcome" className="text-2xl font-semibold text-[color:var(--cs-text)]">
          Oggi, {profile.first_name}
        </h2>
        {isFamilyDashboard ? <p className="text-sm text-secondary">Stai visualizzando {profile.first_name} {profile.last_name}</p> : null}
        {activeSeason?.name && <p className="text-sm text-secondary">{activeSeason.name}</p>}
      </header>

      <div className="cs-athlete-dashboard__layout">
      <div className="cs-athlete-dashboard__sport">
      {canViewSchedule && (
        <Panel id="athlete-events" className="cs-athlete-dashboard__protagonist-panel space-y-3">
          <SectionHeading title="Prossimo impegno" href="/athlete/calendar" />
          {upcomingEvents.length === 0 ? <FeedbackState variant="empty" title="Nessun impegno programmato" className="py-4" /> : visibleEvents.length === 0 ? <FeedbackState variant="filtered-empty" title="Nessun impegno per questa squadra" className="py-4" /> : (
            <div>
              {(() => {
                const event = visibleEvents[0]
                const eventState = getFeaturedEventState(event)
                return (
                  <div className="cs-athlete-dashboard__featured-event">
                    <ListRow
                      interactive
                      onClick={() => setSelectedEvent(event)}
                      className="cs-athlete-dashboard__featured-event-row"
                      trailing={<span className="cs-athlete-dashboard__featured-event-detail text-xs">Dettagli</span>}
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <EventKindBadge kind={event.event_kind} className="cs-event-kind--solid" />
                        <span className="cs-athlete-dashboard__featured-event-time tabular-nums">{formatEventTime(event.start_time)}</span>
                        <span aria-label={featuredEventStateLabel(eventState)} className={`cs-athlete-dashboard__featured-event-state cs-athlete-dashboard__featured-event-state--${eventState}`} role="status">
                          {featuredEventStateLabel(eventState)}
                        </span>
                      </span>
                      <span className="mt-2 block text-xl font-semibold leading-7">{event.title}</span>
                      <span className="cs-athlete-dashboard__featured-event-date mt-1 block text-sm">{formatEventDate(event.start_time)}</span>
                      {event.location ? <span className="mt-1 block text-sm">{event.location}</span> : null}
                      {event.teams && event.teams.length > 0 && <span className="mt-2 flex flex-wrap gap-1">{event.teams.map((team) => <span key={team.id} className="cs-badge cs-badge--neutral">{team.name}</span>)}</span>}
                      {event.my_attendance?.is_early_absence && <span className="mt-2 block text-sm font-medium text-[color:var(--cs-text)]" role="status">Assenza segnalata</span>}
                    </ListRow>
                    {(!isDelegatedProfile || permissions?.confirm_attendance === true) && (
                      <div className="cs-athlete-dashboard__featured-attendance">
                        <AttendanceControl
                          requiresConfirmation={Boolean(event.requires_confirmation)}
                          eventKind={event.event_kind}
                          attendanceMode={event.attendance_mode}
                          confirmationDeadline={event.confirmation_deadline}
                          initialStatus={event.my_attendance?.status || null}
                          canRespond
                          onChange={(status) => persistEventAttendance(event.id, status)}
                          availability={event.attendance_availability}
                          eventContext={{ teams: event.teams?.map((team) => team.name) ?? [], start: event.start_time, end: event.end_time }}
                          initialEarlyAbsence={event.my_attendance?.is_early_absence === true}
                          onEarlyAbsence={(note) => mutateEarlyAbsence(event.id, false, note)}
                          onRevokeEarlyAbsence={() => mutateEarlyAbsence(event.id, true)}
                        />
                      </div>
                    )}
                  </div>
                )
              })()}
              {visibleEvents.length > 1 && (
                <section className="cs-athlete-dashboard__agenda-next mt-5" aria-label="Poi in agenda">
                  <SectionHeading title="Poi in agenda" />
                  <div>
                    {visibleEvents.slice(1, 3).map((event) => (
                      <ListRow
                        key={event.id}
                        interactive
                        onClick={() => setSelectedEvent(event)}
                        aria-label={`Apri dettaglio: ${event.title}`}
                        trailing={<span className="text-xs font-semibold text-secondary">Apri dettagli</span>}
                      >
                        <span className="flex min-w-0 flex-col gap-1">
                          <span className="text-sm font-semibold tabular-nums text-[color:var(--cs-text)]">
                            {formatAgendaDateTime(event.start_time)}
                          </span>
                          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                            <EventKindBadge kind={event.event_kind} />
                            {event.teams && event.teams.length > 0 && (
                              <span className="min-w-0 truncate text-[color:var(--cs-text-secondary)]">
                                {event.teams.map((team) => team.name).join(' · ')}
                              </span>
                            )}
                          </span>
                          {event.location ? (
                            <span className="truncate text-sm text-[color:var(--cs-text-secondary)]">{event.location}</span>
                          ) : null}
                          <span className="sr-only">{event.title}</span>
                        </span>
                      </ListRow>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </Panel>
      )}

      {canViewSchedule && showNextChampionshipMatch && (
        <Panel className="space-y-3">
          <SectionHeading title="Prossima partita" href="/athlete/campionati" />
          {!nextChampionshipMatch ? <FeedbackState variant="empty" title="Nessuna partita in programma" className="py-4" /> : !visibleMatch ? <FeedbackState variant="filtered-empty" title="Nessuna partita per questa squadra" className="py-4" /> : (
            <ListRow className="cs-athlete-dashboard__match-row" leading={<span className="text-xs font-semibold tabular-nums">{visibleMatch.match_date ? new Date(visibleMatch.match_date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) : '—'}</span>}>
              <span className="cs-athlete-dashboard__matchup flex flex-wrap items-center gap-2 font-semibold">
                {visibleMatch.team?.name || (visibleMatch.is_home ? visibleMatch.home_club_team?.name : visibleMatch.away_club_team?.name) || 'Squadra'}
                <span aria-hidden="true">—</span>
                {visibleMatch.opponent?.name || (visibleMatch.is_home ? visibleMatch.away_club_team?.name : visibleMatch.home_club_team?.name) || 'Avversario da definire'}
              </span>
              <span className="cs-athlete-dashboard__match-meta mt-2 block text-sm text-secondary">
                {visibleMatch.start_time ? visibleMatch.start_time.slice(0, 5) : 'Orario da definire'}
                {visibleMatch.location_text ? ` · ${visibleMatch.location_text}` : ''}
                {visibleMatch.match_day ? ` · Giornata ${visibleMatch.match_day}` : ''}
              </span>
              {visibleMatch.is_home !== undefined && <span className="mt-2 block"><StatusBadge status="neutral" label={visibleMatch.is_home ? 'Casa' : 'Trasferta'} /></span>}
            </ListRow>
          )}
        </Panel>
      )}

      </div>

      <div className="cs-athlete-dashboard__services">
      {canReceiveMessages && (
        <Panel id="athlete-messages" className="cs-athlete-dashboard__service-panel space-y-3">
          <SectionHeading title={`Messaggi non letti (${messageTitleCount})`} href="/athlete/messages" />
          {unreadMessages.length === 0 ? <FeedbackState variant="empty" title="Nessun messaggio non letto" className="py-4" /> : visibleMessages.length === 0 ? <FeedbackState variant="filtered-empty" title="Nessun messaggio per questa squadra" className="py-4" /> : (
            <div className="cs-athlete-dashboard__service-list divide-y divide-[color:var(--cs-border)]">
              {visibleMessages.slice(0, 3).map((message, index) => (
                <div key={message.id} className={index === 2 ? 'cs-athlete-dashboard__message-preview--third' : undefined}>
                  <MessagePreviewRow message={message} showReadState={false} onOpen={() => setSelectedMessage(message)} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {canViewPayments && (
        <Panel id="athlete-fees" className="cs-athlete-dashboard__service-panel space-y-3">
          <SectionHeading title="Prossima quota" href="/athlete/fees" />
          {feeInstallments.length === 0 ? <FeedbackState variant="empty" title="Nessuna quota associativa" className="py-4" /> : visibleFees.length === 0 ? <FeedbackState variant="filtered-empty" title="Nessuna quota per questa squadra" className="py-4" /> : !mostUrgentVisibleFee ? <FeedbackState variant="empty" title="Tutte le rate risultano pagate" className="py-4" /> : (
            <ListRow className="cs-athlete-dashboard__fee-row" trailing={(
              <span className="cs-athlete-dashboard__fee-summary">
                <span className="tabular-nums font-semibold">{formatFeeAmount(mostUrgentVisibleFee.amount)}</span>
                <StatusBadge status={mostUrgentVisibleFee.status === 'overdue' ? 'danger' : mostUrgentVisibleFee.status === 'due_soon' || mostUrgentVisibleFee.status === 'partially_paid' ? 'warning' : mostUrgentVisibleFee.status === 'paid' ? 'success' : 'neutral'} label={feeStatusLabel(mostUrgentVisibleFee.status)} />
              </span>
            )}>
              <span className="block font-medium" title={mostUrgentVisibleFee.membership_fee.description || undefined}>
                {mostUrgentVisibleFee.membership_fee.name} · Rata {mostUrgentVisibleFee.installment_number}
              </span>
              <span className="mt-1 block text-sm text-secondary">
                {mostUrgentVisibleFee.membership_fee.team.name}
                {mostUrgentVisibleFee.membership_fee.team.activity?.name ? ` · ${mostUrgentVisibleFee.membership_fee.team.activity.name}` : ''}
                {mostUrgentVisibleFee.membership_fee.team.code ? ` · ${mostUrgentVisibleFee.membership_fee.team.code}` : ''}
                {' · Scadenza '}{new Date(mostUrgentVisibleFee.due_date).toLocaleDateString('it-IT')}
              </span>
            </ListRow>
          )}
        </Panel>
      )}

      <Panel id="athlete-teams" className="cs-athlete-dashboard__service-panel space-y-3">
        <SectionHeading title="Le tue squadre" />
        {teamMemberships.length === 0 ? <FeedbackState variant="empty" title="Non sei iscritto a nessuna squadra" className="py-4" /> : visibleMemberships.length === 0 ? <FeedbackState variant="filtered-empty" title="Nessuna membership per questa squadra" className="py-4" /> : (
          <div className="cs-athlete-dashboard__service-list divide-y divide-[color:var(--cs-border)]">
            {visibleMemberships.map((membership) => (
              <MembershipRow
                key={membership.id}
                membership={membership}
                readOnly={isDelegatedProfile}
                onOpen={() => setSelectedTeamId(membership.team.id)}
              />
            ))}
          </div>
        )}
      </Panel>
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
            requires_confirmation: selectedEvent.requires_confirmation,
            attendance_mode: selectedEvent.attendance_mode,
            confirmation_deadline: selectedEvent.confirmation_deadline,
            my_attendance: selectedEvent.my_attendance,
            attendance_availability: selectedEvent.attendance_availability,
            teams: selectedEvent.teams,
          }}
          onAttendanceChange={selectedEvent.requires_confirmation ? saveEventAttendance : undefined}
          onEarlyAbsence={(note) => mutateEarlyAbsence(selectedEvent.id, false, note)}
          onRevokeEarlyAbsence={() => mutateEarlyAbsence(selectedEvent.id, true)}
          canRespond={Boolean(!isDelegatedProfile || permissions?.confirm_attendance)}
        />
      )}
      {selectedMessage && (
        <MessageDetailModal
          open={true}
          onClose={() => setSelectedMessage(null)}
          messageId={selectedMessage.id}
          subjectProfileId={selectedProfileId}
          markAsRead
          readState={selectedMessage.read_state ?? { is_read: selectedMessage.is_read, read_at: null }}
          onReadStateChange={(state) => setUnreadMessages((current) => current.map((message) => message.id === selectedMessage.id ? { ...message, is_read: state.is_read, read_state: state } : message))}
          data={{
            subject: messageDetail?.subject || selectedMessage.subject,
            content: messageDetail?.content || selectedMessage.content,
            created_at: messageDetail?.created_at || selectedMessage.created_at,
            created_by_profile: messageDetail?.created_by_profile || (selectedMessage as any).created_by_profile || null,
            message_recipients: (messageDetail?.message_recipients as any) || (selectedMessage as any).message_recipients || [],
            attachments: (messageDetail?.attachments || (selectedMessage as any).attachments || []).map((a:any)=>({ id: a.id, file_name: a.file_name, download_url: a.download_url }))
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
