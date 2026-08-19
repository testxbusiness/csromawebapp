import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AccountContextError, requireAccountContext } from '@/server/auth/require-account-context'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const account = await requireAccountContext(supabase)
    if (!account.roles.includes('coach')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 1. Resolve assignments and team rows separately. Keeping the assignment
    // query independent avoids losing teams when PostgREST cannot expand the
    // relation under the current RLS policies.
    const { data: coachTeams, error: coachTeamsErr } = await supabase
      .from('team_coaches')
      .select('team_id')
      .eq('coach_id', account.ownerProfileId)

    if (coachTeamsErr) {
      console.error('Error loading coach teams:', coachTeamsErr)
      return NextResponse.json({ events: [], teams: [] })
    }

    const assignedTeamIds = [...new Set((coachTeams || []).map(row => row.team_id))]
    if (assignedTeamIds.length === 0) {
      return NextResponse.json({ events: [], teams: [] })
    }

    const { data: assignedTeams, error: assignedTeamsErr } = await supabase
      .from('teams')
      .select('id, name, code')
      .in('id', assignedTeamIds)

    if (assignedTeamsErr) {
      console.error('Error loading assigned coach teams:', assignedTeamsErr)
      return NextResponse.json({ events: [], teams: [] })
    }

    const teamData = (assignedTeams || []) as { id: string; name: string; code: string }[]

    if (teamData.length === 0) {
      return NextResponse.json({ events: [], teams: [] })
    }

    const teamIds = teamData.map(t => t.id)

    // 2. Get event-team relations (batch processing for large arrays)
    let eventIds: string[] = []
    let allEventTeamLinks: any[] = [] // STORE for later reuse

    if (teamIds.length > 100) {
      for (let i = 0; i < teamIds.length; i += 100) {
        const batch = teamIds.slice(i, i + 100)
        const { data: relations } = await supabase
          .from('event_teams')
          .select('event_id, team_id')
          .in('team_id', batch)

        allEventTeamLinks.push(...(relations || []))
        eventIds.push(...(relations || []).map(r => r.event_id))
      }
      eventIds = [...new Set(eventIds)]
    } else {
      const { data: relations, error: relErr } = await supabase
        .from('event_teams')
        .select('event_id, team_id')
        .in('team_id', teamIds)

      if (relErr) {
        console.error('Error loading event-team relations:', relErr)
        return NextResponse.json({ events: [], teams: teamData })
      }

      allEventTeamLinks = relations || []
      eventIds = [...new Set((relations || []).map(r => r.event_id))]
    }

    if (eventIds.length === 0) {
      return NextResponse.json({ events: [], teams: teamData })
    }

    // 3. Get upcoming events (same window used by the athlete dashboard)
    const fromDate = new Date()
    const throughDate = new Date(fromDate)
    throughDate.setDate(throughDate.getDate() + 30)

    let allEvents: any[] = []

    if (eventIds.length > 100) {
      for (let i = 0; i < eventIds.length; i += 100) {
        const batch = eventIds.slice(i, i + 100)
        const { data: events } = await supabase
          .from('events')
          .select('id, title, description, location, start_time:start_date, end_time:end_date, event_type, event_kind, parent_event_id, created_by, requires_confirmation, confirmation_deadline')
          .in('id', batch)
          .gte('start_date', fromDate.toISOString())
          .lte('start_date', throughDate.toISOString())

        allEvents.push(...(events || []))
      }
    } else {
      const { data: events, error: evErr } = await supabase
        .from('events')
        .select('id, title, description, location, start_time:start_date, end_time:end_date, event_type, event_kind, parent_event_id, created_by, requires_confirmation, confirmation_deadline')
        .in('id', eventIds)
        .gte('start_date', fromDate.toISOString())
        .lte('start_date', throughDate.toISOString())
        .order('start_date', { ascending: true })
        .limit(10)

      if (evErr) {
        console.error('Error loading events:', evErr)
        return NextResponse.json({ events: [], teams: teamData })
      }

      allEvents = events || []
    }

    // 4. Build team map for events (reuse stored event_teams data, no new query needed)
    const teamIdsByEventId = new Map<string, string[]>()
    const teamNamesByEventId = new Map<string, string[]>()
    const teamNameById = new Map(teamData.map(t => [t.id, t.name]))

    // Use the stored event_teams links instead of querying again
    for (const link of allEventTeamLinks) {
      const idsArr = teamIdsByEventId.get(link.event_id) || []
      if (!idsArr.includes(link.team_id)) {
        idsArr.push(link.team_id)
        teamIdsByEventId.set(link.event_id, idsArr)
      }

      const teamName = teamNameById.get(link.team_id)
      if (!teamName) continue
      const namesArr = teamNamesByEventId.get(link.event_id) || []
      if (!namesArr.includes(teamName)) {
        namesArr.push(teamName)
        teamNamesByEventId.set(link.event_id, namesArr)
      }
    }

    // 5. Transform events
    const transformedEvents = allEvents
      .map((ev: any) => ({
        id: ev.id,
        title: ev.title,
        description: ev.description,
        location: ev.location,
        start_time: ev.start_time,
        end_time: ev.end_time,
        is_recurring: ev.event_type === 'recurring',
        // selected_teams is required on the UI to resolve the names, keep names for backwards compatibility
        selected_teams: teamIdsByEventId.get(ev.id) || [],
        teams: teamNamesByEventId.get(ev.id) || [],
        event_kind: ev.event_kind,
        parent_event_id: ev.parent_event_id,
        created_by: ev.created_by,
        requires_confirmation: ev.requires_confirmation,
        confirmation_deadline: ev.confirmation_deadline
      }))
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      .slice(0, 10)

    return NextResponse.json({
      events: transformedEvents,
      teams: teamData
    })

  } catch (error) {
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Coach calendar API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
