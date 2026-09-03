import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { athleteAttendanceSchema } from '@/lib/validation/events'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireSubjectAthleteContext } from '@/server/auth/require-subject-profile'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await req.json().catch(() => null)
    const { searchParams } = new URL(req.url)
    const querySubjectProfileId = searchParams.get('subjectProfileId')
    const requestedProfileId = typeof body?.subjectProfileId === 'string'
      ? body.subjectProfileId
      : querySubjectProfileId
    const subject = await requireSubjectAthleteContext(supabase, requestedProfileId, 'confirm_attendance')
    const athleteProfileId = subject.profileId
    if (!athleteProfileId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { subjectProfileId: _subjectProfileId, ...attendanceBody } = body ?? {}
    const parsed = athleteAttendanceSchema.safeParse(attendanceBody)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    const { event_id, status, note } = parsed.data

    const { data: event, error: eventError } = await subject.dataClient
      .from('events')
      .select('id, requires_confirmation, confirmation_deadline')
      .eq('id', event_id)
      .maybeSingle()
    if (eventError) return NextResponse.json({ error: 'Impossibile verificare l’evento' }, { status: 500 })
    if (!event) return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 })
    if (!event.requires_confirmation) {
      return NextResponse.json({ error: 'Questo evento non richiede una risposta' }, { status: 409 })
    }
    if (event.confirmation_deadline && new Date(event.confirmation_deadline).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'La deadline per questo evento è superata' }, { status: 409 })
    }

    const { data: eventTeams, error: eventTeamsError } = await subject.dataClient
      .from('event_teams')
      .select('team_id')
      .eq('event_id', event_id)
    if (eventTeamsError) return NextResponse.json({ error: 'Impossibile verificare l’evento' }, { status: 500 })
    const eventTeamIds = (eventTeams || []).map((row) => row.team_id).filter(Boolean)
    if (eventTeamIds.length === 0) return NextResponse.json({ error: 'Evento non associato a una squadra' }, { status: 403 })

    const { data: membership, error: membershipError } = await subject.dataClient
      .from('team_members')
      .select('id')
      .eq('profile_id', athleteProfileId)
      .in('team_id', eventTeamIds)
      .limit(1)
    if (membershipError) return NextResponse.json({ error: 'Impossibile verificare l’accesso all’evento' }, { status: 500 })
    if (!membership || membership.length === 0) return NextResponse.json({ error: 'Non autorizzato per questo evento' }, { status: 403 })

    const { error } = await subject.dataClient
      .from('event_attendances')
      .upsert({
        event_id,
        profile_id: athleteProfileId,
        status,
        note: note || null,
        responded_by_auth_user_id: subject.account.authUserId,
        response_source: subject.delegated ? 'parent' : 'self',
      }, { onConflict: 'event_id,profile_id' })

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
