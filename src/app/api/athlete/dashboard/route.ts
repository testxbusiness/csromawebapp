import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireSubjectAthleteContext } from '@/server/auth/require-subject-profile'
import { buildUnreadMessages, resolveMatchPerspective } from '@/lib/athlete/dashboard-contract'
import { resolveAttendanceAvailability } from '@/server/events/attendance-availability'
import { finishRequestResponse, startRequestTiming } from '@/server/performance/request-timing'

export async function GET(request: NextRequest) {
  const timing = startRequestTiming(request, '/api/athlete/dashboard')
  try {
    const supabase = await createClient()

    const { searchParams } = new URL(request.url)
    const subject = timing
      ? await requireSubjectAthleteContext(supabase, searchParams.get('subjectProfileId'), undefined, timing)
      : await requireSubjectAthleteContext(supabase, searchParams.get('subjectProfileId'))
    const athleteProfileId = subject.profileId
    const dataClient = subject.dataClient
    const activeTeamIds = subject.activeTeamIds ?? []
    const canViewMessages = subject.permissions.receive_messages
    const canViewPayments = subject.permissions.view_payments
    const canViewSchedule = subject.permissions.view_schedule
    if (!athleteProfileId) {
      return finishRequestResponse(NextResponse.json({ error: 'Forbidden' }, { status: 403 }), timing)
    }

    // Execute all queries in parallel
    const membershipStartedAt = timing?.now() ?? 0
    const [memberRes, feeRes] = await Promise.all([
      dataClient
        .from('team_members')
        .select('id, team_id, jersey_number')
        .eq('profile_id', athleteProfileId)
        .in('team_id', activeTeamIds),

      canViewPayments
        ? dataClient
            .from('fee_installments')
            .select('id, installment_number, due_date, amount, status, membership_fee_id')
            .eq('profile_id', athleteProfileId)
            .order('due_date', { ascending: true })
            .order('installment_number', { ascending: true })
            .limit(5)
        : Promise.resolve({ data: [] })
    ])
    timing?.mark('memberships-fees', membershipStartedAt)

    const memberships = memberRes.data
    const feeInstallments = feeRes.data

    // Get team IDs
    const teamIds = [...new Set((memberships || []).map(m => m.team_id).filter(Boolean))]

    const messagesStartedAt = timing?.now() ?? 0
    let msgRecipients: any[] = []
    if (canViewMessages) {
      const recipientFilters = [`profile_id.eq.${athleteProfileId}`]
      if (teamIds.length > 0) recipientFilters.push(`team_id.in.(${teamIds.join(',')})`)

      const recipientsStartedAt = timing?.now() ?? 0
      const { data, error } = await dataClient
        .from('message_recipients')
        .select(`
          message_id,
          team_id,
          profile_id,
          is_read,
          created_at,
          messages(
            id,
            subject,
            content,
            created_at,
            created_by,
            created_by_profile:profiles!messages_created_by_fkey(first_name, last_name)
          )
        `)
        .or(recipientFilters.join(','))
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Error loading dashboard messages:', error)
      } else {
        msgRecipients = data || []
      }
      timing?.mark('dashboard-message-recipients', recipientsStartedAt)
    }

    const messageIds = [...new Set(msgRecipients.map((recipient: any) => recipient.messages?.id).filter(Boolean))]
    // The recipient rows above are already scoped by the subject-aware client.
    // Use the admin client only for this display-only profile lookup: profile
    // RLS can hide a message creator even when the subject may read the message.
    const creatorIds = [...new Set(
      msgRecipients
        .map((recipient: any) => recipient.messages?.created_by)
        .filter(Boolean)
    )]
    const creatorsStartedAt = timing?.now() ?? 0
    const creatorProfilesPromise = canViewMessages && creatorIds.length > 0
      ? createAdminClient()
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', creatorIds)
          .then((result) => {
            timing?.mark('dashboard-message-creators', creatorsStartedAt)
            return result
          })
      : Promise.resolve({ data: [], error: null }).then((result) => {
          timing?.mark('dashboard-message-creators', creatorsStartedAt)
          return result
        })
    const readStateStartedAt = timing?.now() ?? 0
    const readRowsPromise = canViewMessages && messageIds.length > 0
      ? dataClient
          .from('message_reads')
          .select('message_id')
          .eq('auth_user_id', subject.account.authUserId)
          .eq('subject_profile_id', athleteProfileId)
          .in('message_id', messageIds)
          .then((result) => {
            timing?.mark('dashboard-message-read-state', readStateStartedAt)
            return result
          })
      : Promise.resolve({ data: [] }).then((result) => {
          timing?.mark('dashboard-message-read-state', readStateStartedAt)
          return result
        })
    const [
      { data: creatorProfiles, error: creatorProfilesError },
      { data: readRows },
    ] = await Promise.all([creatorProfilesPromise, readRowsPromise])
    if (creatorProfilesError) console.error('Error loading dashboard message creators:', creatorProfilesError)
    const creatorProfilesMap = new Map((creatorProfiles || []).map((creator: any) => [creator.id, creator]))
    const messageTransformStartedAt = timing?.now() ?? 0
    const readMessageIds = new Set((readRows || []).map((row: any) => row.message_id))
    const normalizedMessageRecipients = (msgRecipients || [])
      .filter((recipient: any) => recipient.messages)
      .map((recipient: any) => ({
        team_id: recipient.team_id,
        message: {
          ...recipient.messages,
          created_by_profile: creatorProfilesMap.has(recipient.messages.created_by)
            ? creatorProfilesMap.get(recipient.messages.created_by)
            : recipient.messages.created_by_profile || null,
        },
      }))
    timing?.mark('dashboard-message-transform', messageTransformStartedAt)
    timing?.mark('dashboard-messages', messagesStartedAt)

    if (teamIds.length === 0) {
      const directUnreadMessages = buildUnreadMessages(normalizedMessageRecipients, readMessageIds, new Map())
      return finishRequestResponse(NextResponse.json({
        teamMemberships: [],
        upcomingEvents: [],
        unreadMessages: directUnreadMessages.slice(0, 5),
        unreadMessageCount: directUnreadMessages.length,
        feeInstallments: [],
        activeSeason: subject.activeSeason ?? null,
        teams: [],
      }), timing)
    }

    // Get teams, activities, events, and other data in parallel
    const catalogStartedAt = timing?.now() ?? 0
    const [
      { data: teams },
      { data: eventTeamLinks },
      { data: membershipFees },
      { data: clubTeams }
    ] = await Promise.all([
      dataClient
        .from('teams')
        .select('id, name, code, activity_id')
        .in('id', teamIds),

      canViewSchedule
        ? dataClient
            .from('event_teams')
            .select('event_id, team_id')
            .in('team_id', teamIds)
            .order('created_at', { ascending: false })
            .limit(500)
        : Promise.resolve({ data: [], error: null }),

      feeInstallments && feeInstallments.length > 0
        ? dataClient
            .from('membership_fees')
            .select('id, team_id, name')
            .in('id', (feeInstallments || []).map(f => f.membership_fee_id).filter(Boolean))
            .in('team_id', activeTeamIds)
        : Promise.resolve({ data: [] }),

      dataClient
        .from('championship_club_teams')
        .select('id, team_id')
        .in('team_id', teamIds)
    ])
    timing?.mark('team-catalog', catalogStartedAt)

    // The catalog has resolved all IDs needed by the independent branches below.
    const eventIds = [...new Set((eventTeamLinks || []).map(l => l.event_id).filter(Boolean))]
    const activityIds = [...new Set((teams || []).map(t => t.activity_id).filter(Boolean))]
    const clubTeamIds = [...new Set((clubTeams || []).map((ct: any) => ct.id).filter(Boolean))]

    // Events depend on event-team links, while activities, attendance availability,
    // and championship matches depend only on the catalog/subject IDs. Start those
    // independent branches before waiting for the event rows.
    const enrichmentStartedAt = timing?.now() ?? 0
    const enrichmentQueriesStartedAt = timing?.now() ?? 0
    const eventsStartedAt = timing?.now() ?? 0
    const eventRowsPromise = (async () => {
      if (eventIds.length === 0) return []
      const batches = Array.from({ length: Math.ceil(eventIds.length / 100) }, (_, index) =>
        eventIds.slice(index * 100, index * 100 + 100)
      )
      const eventResults = await Promise.all(batches.map((batch) => dataClient
        .from('events')
        .select('id, title, start_time:start_date, end_time:end_date, location, gym_id, description, event_kind, requires_confirmation, attendance_mode, confirmation_deadline, generated_from_schedule_id')
        .in('id', batch)
        .gte('start_date', new Date().toISOString().split('T')[0] + 'T00:00:00')
        .order('start_date', { ascending: true })
        .limit(10)))
      return eventResults.flatMap(({ data }) => data || [])
    })()
    const eventsPromise = eventRowsPromise.then((events) => {
      timing?.mark('events', eventsStartedAt)
      return events
    })

    // Get activities and enrichment data
    const activitiesPromise = activityIds.length > 0
      ? dataClient
          .from('activities')
          .select('id, name')
          .in('id', activityIds)
      : Promise.resolve({ data: [] })

    const attendanceAvailabilityPromise = canViewSchedule
      ? resolveAttendanceAvailability(dataClient, athleteProfileId, subject.permissions, eventIds, new Date(), activeTeamIds)
      : Promise.resolve(null)

    const nextChampionshipMatchPromise = clubTeamIds.length > 0
      ? dataClient
          .from('championship_matches')
          .select(`
            id, event_id, match_day, match_date, start_time, location_text, status,
            home_club_team:home_club_team_id ( id, name, code, is_home_club, team_id ),
            away_club_team:away_club_team_id ( id, name, code, is_home_club, team_id )
          `)
          .or(`home_club_team_id.in.(${clubTeamIds.join(',')}),away_club_team_id.in.(${clubTeamIds.join(',')})`)
          .eq('status', 'scheduled')
          .gte('match_date', new Date().toISOString().slice(0, 10))
          .order('match_date', { ascending: true })
          .order('start_time', { ascending: true })
          .limit(1)
          .maybeSingle()
          .then(({ data }) => data || null)
      : Promise.resolve(null)

    const allEventsPromise = eventsPromise.then((events) => {
      const gymIds = [...new Set(events.map((event) => event.gym_id).filter(Boolean))]
      const gymsPromise = gymIds.length > 0
        ? dataClient.from('gyms').select('id, name, city').in('id', gymIds)
        : Promise.resolve({ data: [] })
      const attendanceRowsPromise = events.length > 0
        ? dataClient
            .from('event_attendances')
            .select('event_id, status, responded_at, is_early_absence')
            .eq('profile_id', athleteProfileId)
            .in('event_id', events.map((event) => event.id))
        : Promise.resolve({ data: [] })
      return Promise.all([gymsPromise, attendanceRowsPromise]).then(([{ data: gyms }, { data: attendanceRows }]) => ({
        events,
        gyms,
        attendanceRows,
      }))
    })

    const [
      { data: activities },
      { events: allEvents, gyms, attendanceRows },
      attendanceAvailability,
      nextChampionshipMatch,
    ] = await Promise.all([
      activitiesPromise,
      allEventsPromise,
      attendanceAvailabilityPromise,
      nextChampionshipMatchPromise,
    ])
    timing?.mark('dashboard-enrichment-queries', enrichmentQueriesStartedAt)

    timing?.mark('dashboard-enrichment', enrichmentStartedAt)

    if (attendanceAvailability?.nextEvent && !allEvents.some((event) => event.id === attendanceAvailability.nextEvent?.id)) {
      const nextEvent = attendanceAvailability.nextEvent
      allEvents.push({
        id: nextEvent.id,
        title: nextEvent.title || 'Allenamento',
        start_time: nextEvent.start_time,
        end_time: nextEvent.end_time,
        location: nextEvent.location || null,
        gym_id: null,
        description: nextEvent.description || null,
        event_kind: nextEvent.event_kind || 'training',
        requires_confirmation: nextEvent.requires_confirmation,
        attendance_mode: nextEvent.attendance_mode,
        confirmation_deadline: nextEvent.confirmation_deadline || null,
        generated_from_schedule_id: nextEvent.generated_from_schedule_id || null,
      })
    }

    // Build enriched response
    const transformStartedAt = timing?.now() ?? 0
    const activitiesMap = new Map((activities || []).map(a => [a.id, a]))
    const teamsMap = new Map((teams || []).map(t => [t.id, t]))
    const membershipFeesMap = new Map((membershipFees || []).map(f => [f.id, f]))
    const gymsMap = new Map((gyms || []).map((gym) => [gym.id, gym]))
    const attendanceMap = new Map((attendanceRows || []).map((attendance) => [attendance.event_id, attendance]))
    if (attendanceAvailability) {
      for (const [eventId, response] of attendanceAvailability.attendanceByEventId) {
        if (!attendanceMap.has(eventId)) attendanceMap.set(eventId, response)
      }
    }
    const dashboardTeams = (teams || []).map((team) => ({
      id: team.id,
      name: team.name,
      code: team.code,
      activity: {
        id: team.activity_id,
        name: activitiesMap.get(team.activity_id)?.name || 'N/A',
      },
    }))
    const dashboardTeamsMap = new Map(dashboardTeams.map((team) => [team.id, team]))
    const teamsByEventId = new Map<string, typeof dashboardTeams>()
    for (const link of eventTeamLinks || []) {
      const team = dashboardTeamsMap.get(link.team_id)
      if (!team) continue
      const eventTeams = teamsByEventId.get(link.event_id) || []
      if (!eventTeams.some((item) => item.id === team.id)) eventTeams.push(team)
      teamsByEventId.set(link.event_id, eventTeams)
    }
    if (attendanceAvailability?.nextEvent) {
      const nextTeams = attendanceAvailability.nextEvent.team_ids
        .map((teamId) => dashboardTeamsMap.get(teamId))
        .filter((team): team is (typeof dashboardTeams)[number] => Boolean(team))
      teamsByEventId.set(attendanceAvailability.nextEvent.id, nextTeams)
    }

    const enrichedEvents = allEvents.map((event) => {
      const gym = event.gym_id ? gymsMap.get(event.gym_id) : null
      const gymLocation = gym?.name ? `${gym.name}${gym.city ? ` - ${gym.city}` : ''}` : null
      return {
        ...event,
        // A registered gym takes precedence over the free-text location.
        location: gymLocation || event.location || null,
        requires_confirmation: Boolean(event.requires_confirmation),
        attendance_mode: event.attendance_mode === 'absence_only' ? 'absence_only' : 'rsvp',
        confirmation_deadline: event.confirmation_deadline || null,
        my_attendance: attendanceMap.get(event.id) || null,
        attendance_availability: attendanceAvailability?.availabilityByEventId.get(event.id) ?? null,
        teams: teamsByEventId.get(event.id) || [],
        team_ids: (teamsByEventId.get(event.id) || []).map((team) => team.id),
      }
    })

    const enrichedMemberships = (memberships || [])
      .map(m => {
        const team = teamsMap.get(m.team_id)
        if (!team) return null
        return {
          id: m.id,
          jersey_number: m.jersey_number,
          team: {
            id: team.id,
            name: team.name,
            code: team.code,
            team_id: team.id,
            activity: {
              id: team.activity_id,
              name: activitiesMap.get(team.activity_id)?.name || 'N/A'
            }
          }
        }
      })
      .filter(Boolean)

    const enrichedFees = (feeInstallments || [])
      .map(f => {
        const fee = membershipFeesMap.get(f.membership_fee_id)
        if (!fee) return null
        const feeTeam = teamsMap.get(fee.team_id)
        return {
          ...f,
          membership_fee: {
            id: fee.id,
            name: fee.name,
            team: {
              id: feeTeam?.id || fee.team_id,
              name: feeTeam?.name || 'N/A',
              code: feeTeam?.code || 'N/A',
              activity: feeTeam?.activity_id
                ? { id: feeTeam.activity_id, name: activitiesMap.get(feeTeam.activity_id)?.name || 'N/A' }
                : null
            }
          }
        }
      })
      .filter(Boolean)

    const deduplicatedUnreadMessages = buildUnreadMessages(
      normalizedMessageRecipients,
      readMessageIds,
      dashboardTeamsMap,
    )

    const unreadMessages = deduplicatedUnreadMessages.slice(0, 5)

    const normalizedNextChampionshipMatch = nextChampionshipMatch
      ? {
          ...nextChampionshipMatch,
          home_club_team: Array.isArray(nextChampionshipMatch.home_club_team)
            ? nextChampionshipMatch.home_club_team[0] || null
            : nextChampionshipMatch.home_club_team,
          away_club_team: Array.isArray(nextChampionshipMatch.away_club_team)
            ? nextChampionshipMatch.away_club_team[0] || null
            : nextChampionshipMatch.away_club_team,
        }
      : null

    const enrichedNextChampionshipMatch = normalizedNextChampionshipMatch
      ? {
          ...normalizedNextChampionshipMatch,
          ...resolveMatchPerspective(normalizedNextChampionshipMatch, dashboardTeamsMap),
          teams: Array.from(
            [normalizedNextChampionshipMatch.home_club_team, normalizedNextChampionshipMatch.away_club_team]
              .filter((clubTeam: any) => clubTeam?.team_id)
              .reduce((entries: Array<[string, any]>, clubTeam: any) => {
                const team = dashboardTeamsMap.get(clubTeam.team_id)
                if (team) entries.push([clubTeam.team_id, team])
                return entries
              }, [])
              .reduce((unique: Map<string, any>, [id, team]) => unique.set(id, team), new Map<string, any>())
              .values()
          ),
          team_ids: Array.from(new Set(
            [normalizedNextChampionshipMatch.home_club_team, normalizedNextChampionshipMatch.away_club_team]
              .map((clubTeam: any) => clubTeam?.team_id)
              .filter(Boolean)
          )),
        }
      : null
    timing?.mark('dashboard-response-transform', transformStartedAt)

    return finishRequestResponse(NextResponse.json({
      teamMemberships: enrichedMemberships,
      upcomingEvents: enrichedEvents.slice(0, 10),
      nextChampionshipMatch: enrichedNextChampionshipMatch,
      unreadMessages,
      unreadMessageCount: deduplicatedUnreadMessages.length,
      feeInstallments: enrichedFees,
      activeSeason: subject.activeSeason ?? null,
      teams: dashboardTeams,
      attendance_availability: attendanceAvailability
        ? attendanceAvailability.availabilityByEventId.get(attendanceAvailability.nextEvent?.id || '') ?? null
        : null,
    }), timing)

  } catch (error) {
    if (error instanceof AccountContextError) {
      return finishRequestResponse(NextResponse.json({ error: error.message }, { status: error.status }), timing)
    }
    console.error('Athlete dashboard API error:', error)
    return finishRequestResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }), timing)
  }
}
