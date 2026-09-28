import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { earlyAbsenceMutationSchema, earlyAbsencePeriodSchema, EARLY_ABSENCE_MAX_EVENT_IDS } from '@/lib/validation/early-absence'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireSubjectAthleteContext } from '@/server/auth/require-subject-profile'
import { resolveAttendanceAvailability } from '@/server/events/attendance-availability'
import { selectableEarlyAbsenceEvents } from '@/server/events/early-absence'

type TeamLabel = { id: string; name: string; code: string | null }

function domainError(error: unknown, fallback: string) {
  const details = error && typeof error === 'object'
    ? error as { code?: string; message?: string; details?: string; hint?: string }
    : {}
  if (details.code || details.message) {
    console.error('Athlete early absence mutation failed', {
      code: details.code,
      message: details.message,
      details: details.details,
      hint: details.hint,
    })
  }

  if (details.code === 'P0001') {
    const errorByMessage: Record<string, string> = {
      early_absence_event_closed: 'Uno o più eventi non sono più disponibili. Aggiorna il riepilogo.',
      early_absence_event_not_found: 'Uno o più eventi non sono più disponibili. Aggiorna il riepilogo.',
      early_absence_subject_not_member: 'Non puoi comunicare l’assenza per uno o più eventi selezionati.',
      early_absence_response_exists: 'Hai già comunicato una risposta per uno o più eventi selezionati.',
      early_absence_not_found: 'L’assenza da revocare non risulta più presente. Aggiorna il riepilogo.',
      early_absence_note_too_long: 'La nota supera il limite consentito.',
    }
    return NextResponse.json({ error: errorByMessage[details.message ?? ''] ?? 'Uno o più eventi non sono più disponibili. Aggiorna il riepilogo.' }, { status: 409 })
  }
  return NextResponse.json({ error: fallback }, { status: 500 })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parsed = earlyAbsencePeriodSchema.safeParse(Object.fromEntries(searchParams.entries()))
    if (!parsed.success) return NextResponse.json({ error: 'Periodo o paginazione non validi' }, { status: 400 })
    const subject = await requireSubjectAthleteContext(await createClient(), searchParams.get('subjectProfileId'), 'view_schedule')
    const result = await resolveAttendanceAvailability(subject.dataClient, subject.profileId, subject.permissions, [], new Date(), subject.activeTeamIds ?? [])
    const page = selectableEarlyAbsenceEvents(result, parsed.data.from, parsed.data.to, parsed.data.offset, parsed.data.limit)
    const authorizedTeamIds = result.authorizedTeamIds ?? []
    const teamLabels = new Map<string, TeamLabel>()
    if (authorizedTeamIds.length > 0) {
      const { data: teams, error: teamsError } = await subject.dataClient
        .from('teams')
        .select('id, name, code')
        .in('id', authorizedTeamIds)
      if (teamsError) throw teamsError
      for (const team of (teams as TeamLabel[] | null) ?? []) teamLabels.set(team.id, team)
    }
    const events = page.events.map((event) => {
      const teamDetails = (Array.isArray(event.team_ids) ? event.team_ids : [])
        .map((teamId) => teamLabels.get(teamId))
        .filter((team): team is TeamLabel => Boolean(team))
      return {
        ...event,
        teams: teamDetails.map((team) => team.name || team.code || 'Squadra non indicata'),
        team_details: teamDetails,
      }
    })
    return NextResponse.json({ ...page, events, limit: parsed.data.limit, offset: parsed.data.offset })
  } catch (error) {
    if (error instanceof AccountContextError) return NextResponse.json({ error: error.message }, { status: error.status })
    return domainError(error, 'Impossibile caricare gli eventi selezionabili')
  }
}

async function mutate(request: NextRequest, revoke: boolean) {
  try {
    const body = await request.json().catch(() => null)
    const { searchParams } = new URL(request.url)
    const subject = await requireSubjectAthleteContext(await createClient(), searchParams.get('subjectProfileId') ?? (typeof body?.subjectProfileId === 'string' ? body.subjectProfileId : null), 'confirm_attendance')
    const { subjectProfileId: _subjectProfileId, ...payload } = body ?? {}
    const parsed = earlyAbsenceMutationSchema.safeParse(payload)
    if (!parsed.success) return NextResponse.json({ error: 'Payload non valido' }, { status: 400 })
    const eventIds = parsed.data.event_ids
    if (eventIds.length > EARLY_ABSENCE_MAX_EVENT_IDS) return NextResponse.json({ error: `È possibile selezionare al massimo ${EARLY_ABSENCE_MAX_EVENT_IDS} eventi` }, { status: 400 })
    const availability = await resolveAttendanceAvailability(subject.dataClient, subject.profileId, subject.permissions, eventIds, new Date(), subject.activeTeamIds ?? [])
    const action = revoke ? 'revoke_early_absence' : 'report_early_absence'
    if (eventIds.some((id) => availability.availabilityByEventId.get(id)?.actions[action] !== true)) {
      return NextResponse.json({ error: 'Uno o più eventi non sono più disponibili. Aggiorna il riepilogo.' }, { status: 409 })
    }
    const { error } = await createAdminClient().rpc(revoke ? 'revoke_athlete_early_absence' : 'record_athlete_early_absence', {
      p_event_ids: eventIds,
      p_profile_id: subject.profileId,
      ...(revoke ? {} : { p_note: parsed.data.note || null }),
      p_actor_auth_user_id: subject.account.authUserId,
      p_response_source: subject.delegated ? 'parent' : 'self',
    })
    if (error) return domainError(error, revoke ? 'Impossibile revocare l’assenza' : 'Impossibile salvare l’assenza')
    return NextResponse.json({ success: true, event_ids: eventIds })
  } catch (error) {
    if (error instanceof AccountContextError) return NextResponse.json({ error: error.message }, { status: error.status })
    return domainError(error, revoke ? 'Impossibile revocare l’assenza' : 'Impossibile salvare l’assenza')
  }
}

export async function POST(request: NextRequest) { return mutate(request, false) }
export async function DELETE(request: NextRequest) { return mutate(request, true) }
