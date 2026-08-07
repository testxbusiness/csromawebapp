import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { athleteAttendanceSchema } from '@/lib/validation/events'
import { AccountContextError, requireAthleteContext } from '@/server/auth/require-account-context'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const account = await requireAthleteContext(supabase)
    const athleteProfileId = account.ownerProfileId
    if (!athleteProfileId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const parsed = athleteAttendanceSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    const { event_id, status, note } = parsed.data

    const { error } = await supabase
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
