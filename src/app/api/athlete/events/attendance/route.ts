import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { athleteAttendanceSchema } from '@/lib/validation/events'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireSubjectAthleteContext } from '@/server/auth/require-subject-profile'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await req.json().catch(() => null)
    const requestedProfileId = typeof body?.subjectProfileId === 'string' ? body.subjectProfileId : null
    const subject = await requireSubjectAthleteContext(supabase, requestedProfileId, 'confirm_attendance')
    const athleteProfileId = subject.profileId
    if (!athleteProfileId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { subjectProfileId: _subjectProfileId, ...attendanceBody } = body ?? {}
    const parsed = athleteAttendanceSchema.safeParse(attendanceBody)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    const { event_id, status, note } = parsed.data

    const { error } = await subject.dataClient
      .from('event_attendances')
      .upsert({ event_id, profile_id: athleteProfileId, status, note: note || null }, { onConflict: 'event_id,profile_id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (e) {
    if (e instanceof AccountContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error('RSVP error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
