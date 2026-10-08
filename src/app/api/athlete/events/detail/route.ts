import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireSubjectAthleteContext } from '@/server/auth/require-subject-profile'
import { resolveAttendanceAvailability } from '@/server/events/attendance-availability'
import { finishRequestResponse, startRequestTiming } from '@/server/performance/request-timing'

export async function GET(request: NextRequest) {
  const timing = startRequestTiming(request, '/api/athlete/events/detail')
  try {
    const supabase = await createClient()
    const admin = createAdminClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return finishRequestResponse(NextResponse.json({ error: 'Missing id' }, { status: 400 }), timing)

    const subject = timing
      ? await requireSubjectAthleteContext(supabase, searchParams.get('subjectProfileId'), 'view_schedule', timing)
      : await requireSubjectAthleteContext(supabase, searchParams.get('subjectProfileId'), 'view_schedule')
    const athleteProfileId = subject.profileId
    const dataClient = subject.dataClient
    const activeTeamIds = subject.activeTeamIds ?? []
    if (!athleteProfileId) return finishRequestResponse(NextResponse.json({ error: 'Forbidden' }, { status: 403 }), timing)

    // Verify membership to any team of event
    const linksStartedAt = timing?.now() ?? 0
    const { data: links } = await dataClient
      .from('event_teams')
      .select('team_id')
      .eq('event_id', id)
    timing?.mark('event-team-links', linksStartedAt)
    const teamIds = (links || []).map(l => l.team_id)
    if (teamIds.length === 0) return finishRequestResponse(NextResponse.json({ error: 'Not found' }, { status: 404 }), timing)
    const membershipStartedAt = timing?.now() ?? 0
    const { data: member } = await dataClient
      .from('team_members')
      .select('team_id')
      .in('team_id', teamIds)
      .eq('profile_id', athleteProfileId)
      .in('team_id', activeTeamIds)
    timing?.mark('event-team-membership', membershipStartedAt)
    if (!member || member.length === 0) return finishRequestResponse(NextResponse.json({ error: 'Forbidden' }, { status: 403 }), timing)
    // Only expose team context that was authorized for this subject. An event
    // may also be linked to teams where the subject is not a member.
    const authorizedTeamIds = [...new Set(member.map((row) => row.team_id))]

    const eventStartedAt = timing?.now() ?? 0
    const { data: ev } = await dataClient
      .from('events')
      .select('*, generated_from_schedule_id')
      .eq('id', id)
      .maybeSingle()
    timing?.mark('event', eventStartedAt)
    if (!ev) return finishRequestResponse(NextResponse.json({ error: 'Not found' }, { status: 404 }), timing)

    const enrichmentStartedAt = timing?.now() ?? 0
    let gym: any = null
    if (ev.gym_id) {
      const { data } = await dataClient.from('gyms').select('name, address, city').eq('id', ev.gym_id).maybeSingle()
      gym = data
    }
    let teams: any[] = []
    if (authorizedTeamIds.length) {
      const { data } = await dataClient.from('teams').select('id, name, code').in('id', authorizedTeamIds)
      teams = data || []
    }
    let creator: any = null
    if (ev.created_by) {
      const { data } = await admin.from('profiles').select('first_name, last_name').eq('id', ev.created_by).maybeSingle()
      creator = data
    }

    // Current user's attendance (if any)
    const { data: myAtt } = await dataClient
      .from('event_attendances')
      .select('status, responded_at, is_early_absence')
      .eq('event_id', id)
      .eq('profile_id', athleteProfileId)
      .maybeSingle()

    timing?.mark('event-enrichment', enrichmentStartedAt)
    const availabilityStartedAt = timing?.now() ?? 0
    const attendanceAvailability = await resolveAttendanceAvailability(
      dataClient,
      athleteProfileId,
      subject.permissions,
      [id],
      new Date(),
      activeTeamIds,
    )
    timing?.mark('attendance-availability', availabilityStartedAt)

    return finishRequestResponse(NextResponse.json({
      id: ev.id,
      title: ev.title,
      description: ev.description,
      start_date: ev.start_date,
      end_date: ev.end_date,
      location: ev.location,
      event_type: ev.event_type,
      requires_confirmation: ev.requires_confirmation,
      confirmation_deadline: ev.confirmation_deadline,
      my_attendance: myAtt || null,
      attendance_availability: attendanceAvailability.availabilityByEventId.get(id) ?? null,
      gym,
      teams,
      creator,
    }), timing)
  } catch (e) {
    if (e instanceof AccountContextError) {
      return finishRequestResponse(NextResponse.json({ error: e.message }, { status: e.status }), timing)
    }
    return finishRequestResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }), timing)
  }
}
