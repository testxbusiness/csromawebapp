import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { AccountContextError, requireAccountContext } from '@/server/auth/require-account-context'

type EventPayload = {
  title: string
  description?: string
  location?: string
  start_time: string
  end_time: string
  event_kind?: string
  requires_confirmation?: boolean
  confirmation_deadline?: string | null
  selected_teams: string[]
}

type Occurrence = { start_date: string; end_date: string }

async function coachContext() {
  const client = await createClient()
  const account = await requireAccountContext(client)
  if (!account.roles.includes('coach')) throw new AccountContextError('Ruolo coach non abilitato', 403)
  const admin = createAdminClient()
  const { data, error } = await admin.from('team_coaches').select('team_id').eq('coach_id', account.ownerProfileId)
  if (error) throw new AccountContextError('Impossibile verificare le squadre assegnate', 500)
  return { account, admin, assignedTeamIds: new Set((data ?? []).map((row) => row.team_id as string)) }
}

function validEventPayload(value: unknown): value is EventPayload {
  if (!value || typeof value !== 'object') return false
  const event = value as Partial<EventPayload>
  return typeof event.title === 'string'
    && typeof event.start_time === 'string'
    && typeof event.end_time === 'string'
    && Array.isArray(event.selected_teams)
    && event.selected_teams.length > 0
    && event.selected_teams.every((teamId) => typeof teamId === 'string')
}

function eventRow(event: EventPayload, accountId: string, occurrence?: Occurrence) {
  return {
    title: event.title,
    description: event.description || null,
    location: event.location || null,
    start_date: occurrence?.start_date ?? event.start_time,
    end_date: occurrence?.end_date ?? event.end_time,
    event_type: occurrence ? 'recurring' : 'one_time',
    event_kind: event.event_kind || 'training',
    requires_confirmation: Boolean(event.requires_confirmation),
    confirmation_deadline: event.requires_confirmation ? event.confirmation_deadline || null : null,
    created_by: accountId,
    name: event.title,
    start_time: occurrence?.start_date ?? event.start_time,
    end_time: occurrence?.end_date ?? event.end_time,
    kind: 'spot',
  }
}

async function authorizeTeams(assignedTeamIds: Set<string>, teamIds: string[]) {
  if (teamIds.some((teamId) => !assignedTeamIds.has(teamId))) {
    throw new AccountContextError('Squadra non assegnata al coach', 403)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { account, admin, assignedTeamIds } = await coachContext()
    const body = await request.json() as { action?: string; id?: string; event?: unknown; occurrences?: Occurrence[]; deleteSeries?: boolean }
    if (body.action !== 'create' && body.action !== 'update') return NextResponse.json({ error: 'Mutation evento non riconosciuta' }, { status: 400 })
    const event = body.event
    if (!validEventPayload(event)) return NextResponse.json({ error: 'Dati evento non validi' }, { status: 400 })
    await authorizeTeams(assignedTeamIds, event.selected_teams)

    if (body.action === 'update') {
      if (!body.id) return NextResponse.json({ error: 'Evento mancante' }, { status: 400 })
      const { data: links } = await admin.from('event_teams').select('team_id').eq('event_id', body.id)
      const { data: existing } = await admin.from('events').select('created_by').eq('id', body.id).maybeSingle()
      const canEdit = existing?.created_by === account.ownerProfileId || (links ?? []).some((link) => assignedTeamIds.has(link.team_id as string))
      if (!canEdit) return NextResponse.json({ error: 'Evento non autorizzato' }, { status: 403 })
      const { event_type: _eventType, created_by: _createdBy, ...updatedRow } = eventRow(event, account.ownerProfileId)
      const { error } = await admin.from('events').update(updatedRow).eq('id', body.id)
      if (error) return NextResponse.json({ error: 'Impossibile aggiornare evento' }, { status: 400 })
      await admin.from('event_teams').delete().eq('event_id', body.id)
      const { error: linksError } = await admin.from('event_teams').insert(event.selected_teams.map((team_id) => ({ event_id: body.id, team_id })))
      if (linksError) return NextResponse.json({ error: 'Impossibile aggiornare le squadre evento' }, { status: 400 })
      return NextResponse.json({ ok: true })
    }

    const occurrences = body.occurrences?.length ? body.occurrences : [undefined]
    const { data: inserted, error } = await admin.from('events').insert(occurrences.map((occurrence) => eventRow(event, account.ownerProfileId, occurrence))).select('id')
    if (error) return NextResponse.json({ error: 'Impossibile creare evento' }, { status: 400 })
    const ids = (inserted ?? []).map((row) => row.id as string)
    if (ids.length > 1) await admin.from('events').update({ parent_event_id: ids[0] }).in('id', ids)
    const { error: linksError } = await admin.from('event_teams').insert(ids.flatMap((eventId) => event.selected_teams.map((team_id) => ({ event_id: eventId, team_id }))))
    if (linksError) return NextResponse.json({ error: 'Impossibile associare le squadre evento' }, { status: 400 })
    return NextResponse.json({ ok: true, ids })
  } catch (error) {
    if (error instanceof AccountContextError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Coach event mutation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { account, admin, assignedTeamIds } = await coachContext()
    const body = await request.json() as { id?: string; deleteSeries?: boolean }
    if (!body.id) return NextResponse.json({ error: 'Evento mancante' }, { status: 400 })
    const { data: event } = await admin.from('events').select('id, created_by, parent_event_id').eq('id', body.id).maybeSingle()
    if (!event) return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 })
    const { data: links } = await admin.from('event_teams').select('team_id').eq('event_id', body.id)
    const canDelete = event.created_by === account.ownerProfileId || (links ?? []).some((link) => assignedTeamIds.has(link.team_id as string))
    if (!canDelete) return NextResponse.json({ error: 'Evento non autorizzato' }, { status: 403 })
    const seriesId = event.parent_event_id || event.id
    const ids = body.deleteSeries
      ? ((await admin.from('events').select('id').or(`id.eq.${seriesId},parent_event_id.eq.${seriesId}`)).data ?? []).map((row) => row.id as string)
      : [body.id]
    await admin.from('event_teams').delete().in('event_id', ids)
    const { error } = await admin.from('events').delete().in('id', ids)
    if (error) return NextResponse.json({ error: 'Impossibile eliminare evento' }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof AccountContextError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Coach event deletion error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
