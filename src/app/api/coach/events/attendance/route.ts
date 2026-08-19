import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { AccountContextError, requireAccountContext } from '@/server/auth/require-account-context'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()
    const account = await requireAccountContext(supabase)
    if (!account.roles.includes('coach')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const eventId = new URL(request.url).searchParams.get('event_id')
    if (!eventId) return NextResponse.json({ error: 'Missing event_id' }, { status: 400 })

    const { data: eventLinks, error: eventLinksError } = await admin
      .from('event_teams')
      .select('team_id')
      .eq('event_id', eventId)
    if (eventLinksError) throw eventLinksError

    const teamIds = [...new Set((eventLinks || []).map((link) => link.team_id))]
    if (teamIds.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: assignments, error: assignmentsError } = await admin
      .from('team_coaches')
      .select('team_id')
      .eq('coach_id', account.ownerProfileId)
      .in('team_id', teamIds)
    if (assignmentsError) throw assignmentsError
    if (!assignments || assignments.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: members, error: membersError } = await admin
      .from('team_members')
      .select('profile_id, profiles(id, first_name, last_name, email)')
      .in('team_id', teamIds)
    if (membersError) throw membersError

    const profileRows = (members || []).flatMap((member) => (
      Array.isArray(member.profiles) ? member.profiles : [member.profiles]
    )).filter((profile): profile is NonNullable<typeof profile> => Boolean(profile))
    const profiles = Array.from(new Map(profileRows.map((profile) => [profile.id, profile] as const)).values())

    const { data: attendances, error: attendancesError } = await admin
      .from('event_attendances')
      .select('profile_id, status, responded_at, profiles(first_name,last_name,email)')
      .eq('event_id', eventId)
    if (attendancesError) throw attendancesError

    const byProfileId = new Map((attendances || []).map((attendance) => [attendance.profile_id, attendance]))
    const going = []
    const maybe = []
    const declined = []
    const noResponse = []

    for (const profile of profiles) {
      const attendance = byProfileId.get(profile.id)
      if (!attendance) noResponse.push(profile)
      else if (attendance.status === 'going') going.push(attendance)
      else if (attendance.status === 'maybe') maybe.push(attendance)
      else declined.push(attendance)
    }

    return NextResponse.json({
      going,
      maybe,
      declined,
      no_response: noResponse,
      counts: {
        going: going.length,
        maybe: maybe.length,
        declined: declined.length,
        no_response: noResponse.length,
      },
    })
  } catch (error) {
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Coach RSVP report error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
