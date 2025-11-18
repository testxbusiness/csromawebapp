import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (user as any)?.user_metadata?.role
    if (role !== 'coach') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 1. Get coach's teams via team_coaches join
    const { data: coachTeams, error: coachTeamsErr } = await supabase
      .from('team_coaches')
      .select('team_id, teams(id, name, code)')
      .eq('coach_id', user.id)

    if (coachTeamsErr) {
      console.error('Error loading coach teams:', coachTeamsErr)
      return NextResponse.json({ events: [], teams: [] })
    }

    const teamData = (coachTeams || [])
      .map(row => row.teams)
      .filter(Boolean) as { id: string; name: string; code: string }[]

    if (teamData.length === 0) {
      return NextResponse.json({ events: [], teams: [] })
    }

    const teamIds = teamData.map(t => t.id)

    // 2. Get event-team relations (batch processing for large arrays)
    let eventIds: string[] = []

    if (teamIds.length > 100) {
      for (let i = 0; i < teamIds.length; i += 100) {
        const batch = teamIds.slice(i, i + 100)
        const { data: relations } = await supabase
          .from('event_teams')
          .select('event_id, team_id')
          .in('team_id', batch)

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

      eventIds = [...new Set((relations || []).map(r => r.event_id))]
    }

    if (eventIds.length === 0) {
      return NextResponse.json({ events: [], teams: teamData })
    }

    // 3. Get events (batch processing)
    let allEvents: any[] = []

    if (eventIds.length > 100) {
      for (let i = 0; i < eventIds.length; i += 100) {
        const batch = eventIds.slice(i, i + 100)
        const { data: events } = await supabase
          .from('events')
          .select('id, title, description, location, start_time:start_date, end_time:end_date, event_type, event_kind, parent_event_id, created_by')
          .in('id', batch)

        allEvents.push(...(events || []))
      }
    } else {
      const { data: events, error: evErr } = await supabase
        .from('events')
        .select('id, title, description, location, start_time:start_date, end_time:end_date, event_type, event_kind, parent_event_id, created_by')
        .in('id', eventIds)
        .order('start_date', { ascending: false })

      if (evErr) {
        console.error('Error loading events:', evErr)
        return NextResponse.json({ events: [], teams: teamData })
      }

      allEvents = events || []
    }

    // 4. Build team map for events
    const teamsByEventId = new Map<string, string[]>()
    const teamNameById = new Map(teamData.map(t => [t.id, t.name]))

    if (allEvents.length > 0) {
      const eventIdsList = allEvents.map(e => e.id)
      const { data: eventTeamLinks } = await supabase
        .from('event_teams')
        .select('event_id, team_id')
        .in('event_id', eventIdsList)

      for (const link of (eventTeamLinks || [])) {
        const teamName = teamNameById.get(link.team_id)
        if (!teamName) continue
        const arr = teamsByEventId.get(link.event_id) || []
        if (!arr.includes(teamName)) arr.push(teamName)
        teamsByEventId.set(link.event_id, arr)
      }
    }

    // 5. Transform events
    const transformedEvents = allEvents.map((ev: any) => ({
      id: ev.id,
      title: ev.title,
      description: ev.description,
      location: ev.location,
      start_time: ev.start_time,
      end_time: ev.end_time,
      is_recurring: ev.event_type === 'recurring',
      teams: teamsByEventId.get(ev.id) || [],
      event_kind: ev.event_kind,
      parent_event_id: ev.parent_event_id,
      created_by: ev.created_by
    }))

    return NextResponse.json({
      events: transformedEvents,
      teams: teamData
    })

  } catch (error) {
    console.error('Coach calendar API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
