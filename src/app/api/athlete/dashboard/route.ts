import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireSubjectAthleteContext } from '@/server/auth/require-subject-profile'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { searchParams } = new URL(request.url)
    const subject = await requireSubjectAthleteContext(supabase, searchParams.get('subjectProfileId'))
    const athleteProfileId = subject.profileId
    const dataClient = subject.dataClient
    const canViewMessages = subject.permissions.receive_messages
    const canViewPayments = subject.permissions.view_payments
    if (!athleteProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Execute all queries in parallel
    const [seasonRes, memberRes, feeRes] = await Promise.all([
      // 1. Get active season
      dataClient
        .from('seasons')
        .select('*')
        .eq('is_active', true)
        .single(),

      // 2. Get team memberships
      dataClient
        .from('team_members')
        .select('id, team_id, jersey_number')
        .eq('profile_id', athleteProfileId),

      // 3. Get fee installments
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

    const seasons = seasonRes.data
    const memberships = memberRes.data
    const feeInstallments = feeRes.data

    // Get team IDs
    const teamIds = [...new Set((memberships || []).map(m => m.team_id).filter(Boolean))]

    let msgRecipients: any[] = []
    if (canViewMessages) {
      const recipientFilters = [`profile_id.eq.${athleteProfileId}`]
      if (teamIds.length > 0) recipientFilters.push(`team_id.in.(${teamIds.join(',')})`)

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
    }

    const messageIds = [...new Set(msgRecipients.map((recipient: any) => recipient.messages?.id).filter(Boolean))]
    const { data: readRows } = canViewMessages && messageIds.length > 0
      ? await dataClient
          .from('message_reads')
          .select('message_id')
          .eq('auth_user_id', subject.account.authUserId)
          .eq('subject_profile_id', athleteProfileId)
          .in('message_id', messageIds)
      : { data: [] }
    const readMessageIds = new Set((readRows || []).map((row: any) => row.message_id))

    if (teamIds.length === 0) {
      return NextResponse.json({
        teamMemberships: [],
        upcomingEvents: [],
        unreadMessages: (msgRecipients || [])
          .filter(r => r.messages && !readMessageIds.has(r.messages.id))
          .map((r: any) => ({
            id: r.messages.id,
            subject: r.messages.subject,
            content: r.messages.content,
            created_at: r.messages.created_at,
            is_read: false
          }))
          .slice(0, 5),
        feeInstallments: [],
        activeSeason: seasons
      })
    }

    // Get teams, activities, events, and other data in parallel
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

      dataClient
        .from('event_teams')
        .select('event_id, created_at')
        .in('team_id', teamIds)
        .order('created_at', { ascending: false })
        .limit(500),

      feeInstallments && feeInstallments.length > 0
        ? dataClient
            .from('membership_fees')
            .select('id, team_id, name')
            .in('id', (feeInstallments || []).map(f => f.membership_fee_id).filter(Boolean))
        : Promise.resolve({ data: [] }),

      dataClient
        .from('championship_club_teams')
        .select('id, team_id')
        .in('team_id', teamIds)
    ])

    // Get event IDs
    const eventIds = [...new Set((eventTeamLinks || []).map(l => l.event_id).filter(Boolean))]

    // Get events (with batch processing if needed)
    let allEvents: any[] = []
    if (eventIds.length > 0) {
      if (eventIds.length > 100) {
        for (let i = 0; i < eventIds.length; i += 100) {
          const batch = eventIds.slice(i, i + 100)
        const { data: events } = await dataClient
          .from('events')
          .select('id, title, start_time:start_date, end_time:end_date, location, gym_id, description, event_kind, requires_confirmation, confirmation_deadline')
          .in('id', batch)
          .gte('start_date', new Date().toISOString().split('T')[0] + 'T00:00:00')
          .order('start_date', { ascending: true })
          .limit(10)
        allEvents.push(...(events || []))
      }
    } else {
      const { data: events } = await dataClient
        .from('events')
        .select('id, title, start_time:start_date, end_time:end_date, location, gym_id, description, event_kind, requires_confirmation, confirmation_deadline')
        .in('id', eventIds)
        .gte('start_date', new Date().toISOString().split('T')[0] + 'T00:00:00')
        .order('start_date', { ascending: true })
        .limit(10)
      allEvents = events || []
    }
    }

    // Get activities and enriched team data
    const activityIds = [...new Set((teams || []).map(t => t.activity_id).filter(Boolean))]
    const { data: activities } = activityIds.length > 0
      ? await dataClient
          .from('activities')
          .select('id, name')
          .in('id', activityIds)
      : { data: [] }

    const gymIds = [...new Set((allEvents || []).map((event) => event.gym_id).filter(Boolean))]
    const [{ data: gyms }, { data: attendanceRows }] = await Promise.all([
      gymIds.length > 0
        ? dataClient.from('gyms').select('id, name, city').in('id', gymIds)
        : Promise.resolve({ data: [] }),
      allEvents.length > 0
        ? dataClient
            .from('event_attendances')
            .select('event_id, status, responded_at')
            .eq('profile_id', athleteProfileId)
            .in('event_id', allEvents.map((event) => event.id))
        : Promise.resolve({ data: [] }),
    ])

    let nextChampionshipMatch = null
    const clubTeamIds = [...new Set((clubTeams || []).map((ct: any) => ct.id).filter(Boolean))]
    if (clubTeamIds.length > 0) {
      const clubTeamList = clubTeamIds.join(',')
      const { data: nextMatch } = await dataClient
        .from('championship_matches')
        .select(`
          id, match_day, match_date, start_time, location_text, status,
          home_club_team:home_club_team_id ( id, name, code, is_home_club, team_id ),
          away_club_team:away_club_team_id ( id, name, code, is_home_club, team_id )
        `)
        .or(`home_club_team_id.in.(${clubTeamList}),away_club_team_id.in.(${clubTeamList})`)
        .eq('status', 'scheduled')
        .gte('match_date', new Date().toISOString().slice(0, 10))
        .order('match_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(1)
        .maybeSingle()
      nextChampionshipMatch = nextMatch || null
    }

    // Build enriched response
    const activitiesMap = new Map((activities || []).map(a => [a.id, a]))
    const teamsMap = new Map((teams || []).map(t => [t.id, t]))
    const membershipFeesMap = new Map((membershipFees || []).map(f => [f.id, f]))
    const gymsMap = new Map((gyms || []).map((gym) => [gym.id, gym]))
    const attendanceMap = new Map((attendanceRows || []).map((attendance) => [attendance.event_id, attendance]))

    const enrichedEvents = allEvents.map((event) => {
      const gym = event.gym_id ? gymsMap.get(event.gym_id) : null
      const gymLocation = gym?.name ? `${gym.name}${gym.city ? ` - ${gym.city}` : ''}` : null
      return {
        ...event,
        // A registered gym takes precedence over the free-text location.
        location: gymLocation || event.location || null,
        requires_confirmation: Boolean(event.requires_confirmation),
        confirmation_deadline: event.confirmation_deadline || null,
        my_attendance: attendanceMap.get(event.id) || null,
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
            activity: {
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
            name: fee.name,
            team: {
              name: feeTeam?.name || 'N/A'
            }
          }
        }
      })
      .filter(Boolean)

    const unreadMessages = Array.from(
      (msgRecipients || [])
        .filter(r => r.messages && !readMessageIds.has(r.messages.id))
        .reduce((messages: Map<string, any>, recipient: any) => {
          if (!messages.has(recipient.messages.id)) {
            messages.set(recipient.messages.id, {
              id: recipient.messages.id,
              subject: recipient.messages.subject,
              content: recipient.messages.content,
              created_at: recipient.messages.created_at,
              is_read: false,
              created_by_profile: recipient.messages.created_by_profile || null
            })
          }
          return messages
        }, new Map<string, any>())
        .values()
    ).slice(0, 5)

    return NextResponse.json({
      teamMemberships: enrichedMemberships,
      upcomingEvents: enrichedEvents.slice(0, 10),
      nextChampionshipMatch,
      unreadMessages,
      feeInstallments: enrichedFees,
      activeSeason: seasons
    })

  } catch (error) {
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Athlete dashboard API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
