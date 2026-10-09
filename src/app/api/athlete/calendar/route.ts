import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireSubjectAthleteContext } from '@/server/auth/require-subject-profile'
import { buildCalendarEvents } from '@/lib/athlete/calendar-contract'
import { resolveAttendanceAvailability, type AttendanceResolverEvent, type AttendanceResolverResponse } from '@/server/events/attendance-availability'
import type { AthleteCalendarTeam } from '@/types/athlete-calendar'
import type { AttendanceStatus } from '@/types/attendance'
import { finishRequestResponse, startRequestTiming } from '@/server/performance/request-timing'

type EventTeamLink = { event_id: string; team_id: string }
type CalendarEventRow = {
  id: string
  title: string
  description: string | null
  location: string | null
  start_time: string
  end_time: string
  event_type: string | null
  event_kind: string | null
  requires_confirmation: boolean | null
  attendance_mode: 'rsvp' | 'absence_only' | null
  confirmation_deadline: string | null
  generated_from_schedule_id: string | null
}
type AttendanceRow = {
  event_id: string
  status: AttendanceStatus
  responded_at: string | null
  is_early_absence: boolean
  response_source?: string | null
}

function calendarLoadError() {
  return NextResponse.json(
    { error: 'Impossibile caricare il calendario' },
    { status: 500 },
  )
}

export async function GET(request: NextRequest) {
  const timing = startRequestTiming(request, '/api/athlete/calendar')
  try {
    const supabase = await createClient()

    const { searchParams } = new URL(request.url)
    const subject = timing
      ? await requireSubjectAthleteContext(supabase, searchParams.get('subjectProfileId'), 'view_schedule', timing)
      : await requireSubjectAthleteContext(supabase, searchParams.get('subjectProfileId'), 'view_schedule')
    const athleteProfileId = subject.profileId
    const dataClient = subject.dataClient
    const activeTeamIds = subject.activeTeamIds ?? []

    // 1. Get athlete's team memberships
    const membershipsStartedAt = timing?.now() ?? 0
    const { data: memberships, error: memberErr } = await dataClient
      .from('team_members')
      .select('team_id')
      .eq('profile_id', athleteProfileId)
      .in('team_id', activeTeamIds)
    timing?.mark('team-memberships', membershipsStartedAt)

    if (memberErr) {
      console.error('Error loading athlete team memberships:', memberErr)
      return finishRequestResponse(calendarLoadError(), timing)
    }

    const teamIds = [...new Set((memberships || []).map(m => m.team_id).filter(Boolean))]
    if (teamIds.length === 0) {
      return finishRequestResponse(NextResponse.json({ events: [], teams: [] }), timing)
    }

    // 2. Get team details
    // 3. Get event-team relations (batch processing for large arrays)
    const teamsStartedAt = timing?.now() ?? 0
    const relationsStartedAt = timing?.now() ?? 0
    const teamsPromise = dataClient
      .from('teams')
      .select('id, name, code')
      .in('id', teamIds)
      .then((result) => {
        timing?.mark('teams', teamsStartedAt)
        return result
      })
    const relationsPromise = (async () => {
      let allLinks: EventTeamLink[] = []
      try {
        for (let i = 0; i < teamIds.length; i += 100) {
          const batch = teamIds.slice(i, i + 100)
          const { data: relations, error: relationsError } = await dataClient
            .from('event_teams')
            .select('event_id, team_id')
            .in('team_id', batch)
          if (relationsError) return { data: [], error: relationsError }
          allLinks.push(...(relations || []))
        }
      } catch (error) {
        return { data: [], error }
      }
      timing?.mark('event-team-relations', relationsStartedAt)
      return { data: allLinks, error: null }
    })()
    const [{ data: teams, error: teamsErr }, relationsResult] = await Promise.all([teamsPromise, relationsPromise])

    if (teamsErr) {
      console.error('Error loading athlete teams:', teamsErr)
      return finishRequestResponse(calendarLoadError(), timing)
    }
    if (relationsResult.error) {
      console.error('Error loading event-team relations:', relationsResult.error)
      return finishRequestResponse(calendarLoadError(), timing)
    }

    const teamData: AthleteCalendarTeam[] = (teams || []).map(t => ({ id: t.id, name: t.name, code: t.code }))
    const allEventTeamLinks = relationsResult.data
    const eventIds = [...new Set(allEventTeamLinks.map((link) => link.event_id))]

    if (eventIds.length === 0) {
      return finishRequestResponse(NextResponse.json({ events: [], teams: teamData }), timing)
    }

    // 4. Get events (batch processing)
    const eventsStartedAt = timing?.now() ?? 0
    const attendanceStartedAt = timing?.now() ?? 0
    const eventsPromise = eventIds.length > 100
      ? Promise.all(
          Array.from({ length: Math.ceil(eventIds.length / 100) }, (_, index) =>
            dataClient
              .from('events')
              .select('id, title, description, location, start_time:start_date, end_time:end_date, event_type, event_kind, requires_confirmation, attendance_mode, confirmation_deadline, generated_from_schedule_id')
              .in('id', eventIds.slice(index * 100, (index + 1) * 100)),
          ),
        ).then((batches) => ({
          data: batches.flatMap((batch) => batch.data || []),
          error: batches.find((batch) => batch.error)?.error || null,
        }))
      : dataClient
          .from('events')
          .select('id, title, description, location, start_time:start_date, end_time:end_date, event_type, event_kind, requires_confirmation, attendance_mode, confirmation_deadline, generated_from_schedule_id')
          .in('id', eventIds)
          .order('start_date', { ascending: true })
    const attendanceQuery = dataClient
      .from('event_attendances')
      .select('event_id, status, responded_at, is_early_absence, response_source')
      .eq('profile_id', athleteProfileId)
      .in('event_id', eventIds)
    const [{ data: allEvents, error: eventsError }, { data: attendanceRows, error: attendanceError }] = await Promise.all([eventsPromise, attendanceQuery])
    if (eventsError) {
      console.error('Error loading athlete events:', eventsError)
      return finishRequestResponse(calendarLoadError(), timing)
    }
    timing?.mark('events', eventsStartedAt)

    // 5. Build team map for events (reuse stored event_teams data, no new query needed)
    const teamsByEventId = new Map<string, AthleteCalendarTeam[]>()
    const eventTeamIdsByEventId = new Map<string, string[]>()
    const teamById = new Map(teamData.map(t => [t.id, t]))

    // Use the stored event_teams links instead of querying again
    for (const link of allEventTeamLinks) {
      const team = teamById.get(link.team_id)
      if (!team) continue
      const arr = teamsByEventId.get(link.event_id) || []
      if (!arr.some((item) => item.id === team.id)) arr.push(team)
      teamsByEventId.set(link.event_id, arr)
      const teamIdsForEvent = eventTeamIdsByEventId.get(link.event_id) || []
      if (!teamIdsForEvent.includes(link.team_id)) teamIdsForEvent.push(link.team_id)
      eventTeamIdsByEventId.set(link.event_id, teamIdsForEvent)
    }

    if (attendanceError) {
      console.error('Error loading athlete event attendance:', attendanceError)
      return finishRequestResponse(calendarLoadError(), timing)
    }
    timing?.mark('attendance', attendanceStartedAt)

    const attendance = new Map<string, AttendanceRow>(
      ((attendanceRows || []) as AttendanceRow[]).map((row) => [row.event_id, row]),
    )
    const availabilityStartedAt = timing?.now() ?? 0
    const attendanceAvailability = await resolveAttendanceAvailability(
      dataClient,
      athleteProfileId,
      subject.permissions,
      eventIds,
      new Date(),
      activeTeamIds,
      {
        authorizedTeamIds: teamIds,
        events: (allEvents || []).map((event): AttendanceResolverEvent => ({
          ...event,
          team_ids: eventTeamIdsByEventId.get(event.id) || [],
        })),
        attendanceByEventId: new Map<string, AttendanceResolverResponse>(
          ((attendanceRows || []) as AttendanceRow[]).map((row) => [row.event_id, row]),
        ),
      },
    )
    timing?.mark('attendance-availability', availabilityStartedAt)
    const transformStartedAt = timing?.now() ?? 0
    const transformedEvents = buildCalendarEvents(
      allEvents,
      teamsByEventId,
      attendance,
    ).map((event) => ({
      ...event,
      attendance_availability: attendanceAvailability.availabilityByEventId.get(event.id) ?? null,
    }))
    timing?.mark('transform', transformStartedAt)

    return finishRequestResponse(NextResponse.json({
      events: transformedEvents,
      teams: teamData
    }), timing)

  } catch (error) {
    if (error instanceof AccountContextError) {
      return finishRequestResponse(NextResponse.json({ error: error.message }, { status: error.status }), timing)
    }
    console.error('Athlete calendar API error:', error)
    return finishRequestResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }), timing)
  }
}
