import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { eventIdQuerySchema } from '@/lib/validation/events'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'
import { buildAttendanceReport, type AttendanceReportEntry, type AttendanceReportProfile } from '@/server/events/attendance-report'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    await requireGlobalRole(supabase, 'admin')
    const admin = createAdminClient()

    const { searchParams } = new URL(req.url)
    const parsed = eventIdQuerySchema.safeParse({ event_id: searchParams.get('event_id') })
    if (!parsed.success) return NextResponse.json({ error: 'Missing event_id' }, { status: 400 })
    const eventId = parsed.data.event_id

    const { data: event } = await admin.from('events').select('attendance_mode').eq('id', eventId).maybeSingle()
    if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    // Fetch teams attached to event
    const { data: links } = await admin.from('event_teams').select('team_id').eq('event_id', eventId)
    const teamIds = (links || []).map((l: any) => l.team_id)
    const { data: members } = await admin
      .from('team_members')
      .select('profile_id, profiles(id, first_name, last_name, email)')
      .in('team_id', teamIds)

    // An athlete can belong to more than one team attached to the same event.
    // Deduplicate the recipient list so the report counts each athlete once.
    const allProfiles = Array.from(
      new Map(
        (members || [])
          .map((member: any) => member.profiles)
          .filter(Boolean)
          .map((profile: any) => [profile.id, profile] as const)
      ).values()
    )
    const { data: atts } = await admin
      .from('event_attendances')
      .select('profile_id, status, responded_at, profiles(first_name,last_name,email)')
      .eq('event_id', eventId)

    return NextResponse.json(buildAttendanceReport(
      event.attendance_mode === 'absence_only' ? 'absence_only' : 'rsvp',
      allProfiles as AttendanceReportProfile[],
      (atts ?? []) as unknown as AttendanceReportEntry[],
    ))
  } catch (e) {
    if (e instanceof AccountContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
