import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { AccountContextError, requireAccountContext } from '@/server/auth/require-account-context'
import { buildAttendanceReport, type AttendanceReportEntry, type AttendanceReportProfile } from '@/server/events/attendance-report'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()
    const account = await requireAccountContext(supabase)
    if (!account.roles.includes('coach')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const searchParams = new URL(request.url).searchParams
    const eventId = searchParams.get('event_id')
    const requestedTeamId = searchParams.get('team_id')
    if (!eventId) return NextResponse.json({ error: 'Missing event_id' }, { status: 400 })

    const { data: eventLinks, error: eventLinksError } = await admin
      .from('event_teams')
      .select('team_id')
      .eq('event_id', eventId)
    if (eventLinksError) throw eventLinksError

    const teamIds = [...new Set((eventLinks || []).map((link) => link.team_id))]
    if (teamIds.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (requestedTeamId && !teamIds.includes(requestedTeamId)) {
      return NextResponse.json({ error: 'Squadra non associata all’evento' }, { status: 403 })
    }

    const { data: assignments, error: assignmentsError } = await admin
      .from('team_coaches')
      .select('team_id')
      .eq('coach_id', account.ownerProfileId)
      .in('team_id', teamIds)
    if (assignmentsError) throw assignmentsError
    if (!assignments || assignments.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (requestedTeamId && !assignments.some((assignment) => assignment.team_id === requestedTeamId)) {
      return NextResponse.json({ error: 'Squadra non assegnata al coach' }, { status: 403 })
    }

    // Never expand an event to a team the coach does not supervise. An event
    // may belong to several teams and authorization must restrict that set.
    const assignedTeamIds = assignments.map((assignment) => assignment.team_id)
    const visibleTeamIds = requestedTeamId ? [requestedTeamId] : assignedTeamIds
    const { data: members, error: membersError } = await admin
      .from('team_members')
      .select('profile_id, profiles(id, first_name, last_name, email)')
      .in('team_id', visibleTeamIds)
    if (membersError) throw membersError

    const profileRows = (members || []).flatMap((member) => (
      Array.isArray(member.profiles) ? member.profiles : [member.profiles]
    )).filter((profile): profile is NonNullable<typeof profile> => Boolean(profile))
    const profiles = Array.from(new Map(profileRows.map((profile) => [profile.id, profile] as const)).values())

    const [{ data: event, error: eventError }, { data: attendances, error: attendancesError }] = await Promise.all([
      admin.from('events').select('attendance_mode').eq('id', eventId).maybeSingle(),
      admin.from('event_attendances')
      .select('profile_id, status, responded_at, profiles(first_name,last_name,email)')
      .eq('event_id', eventId),
    ])
    if (eventError || !event) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (attendancesError) throw attendancesError
    return NextResponse.json(buildAttendanceReport(
      event.attendance_mode === 'absence_only' ? 'absence_only' : 'rsvp',
      profiles as AttendanceReportProfile[],
      (attendances ?? []) as unknown as AttendanceReportEntry[],
    ))
  } catch (error) {
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Coach RSVP report error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
