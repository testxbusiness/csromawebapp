import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { athleteAttendanceSchema } from '@/lib/validation/events'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireSubjectAthleteContext } from '@/server/auth/require-subject-profile'
import { resolveAttendanceAvailability } from '@/server/events/attendance-availability'

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
    const now = new Date()
    const availability = await resolveAttendanceAvailability(
      subject.dataClient,
      athleteProfileId,
      subject.permissions,
      [event_id],
      now,
    )
    const event = availability.events.find((candidate) => candidate.id === event_id)
    if (!event) return NextResponse.json({ error: 'Evento non trovato o non accessibile' }, { status: 404 })

    const capability = availability.availabilityByEventId.get(event_id)
    if (event.generated_from_schedule_id && event.requires_confirmation === true && !capability?.actions.respond) {
      const errorByReason = {
        not_required: 'Questo evento non richiede una risposta',
        not_authorized: 'Non autorizzato a rispondere per questo profilo',
        event_started: 'L’evento è già iniziato',
        not_next_event: 'È disponibile prima un altro evento per la risposta',
        deadline_passed: 'La deadline per questo evento è superata',
        already_responded: 'Hai già risposto a questo evento',
        already_early_absence: 'Per questo evento è già stata segnalata un’assenza',
      } as const
      const message = capability?.closure_reason
        ? errorByReason[capability.closure_reason]
        : 'Questo evento non è disponibile per una risposta'
      return NextResponse.json({ error: message }, { status: 409 })
    }

    // Il client autenticato/delegato serve solo a risolvere il contesto e R4.
    // La scrittura passa dal RPC service-only, che ricontrolla tempo e ordine
    // nella stessa transazione: l'admin client non è usato come prova RLS.
    const { error } = await createAdminClient().rpc('record_athlete_attendance', {
      p_event_id: event_id,
      p_profile_id: athleteProfileId,
      p_status: status,
      p_note: note || null,
      p_actor_auth_user_id: subject.account.authUserId,
      p_response_source: subject.delegated ? 'parent' : 'self',
    })

    if (error) {
      if (error.code === 'P0001' || error.code === '23514') {
        return NextResponse.json({ error: 'L’evento non è più disponibile per una risposta' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Impossibile salvare la risposta' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    if (e instanceof AccountContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error('RSVP error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
