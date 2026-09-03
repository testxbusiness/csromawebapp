import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { AccountContextError, requireAccountContext } from '@/server/auth/require-account-context'

type CoachMutationContext = {
  admin: ReturnType<typeof createAdminClient>
  coachId: string
  teamIds: Set<string>
}

async function getContext(): Promise<CoachMutationContext> {
  const client = await createClient()
  const account = await requireAccountContext(client)
  if (!account.roles.includes('coach')) throw new AccountContextError('Ruolo coach non abilitato', 403)
  const admin = createAdminClient()
  const { data, error } = await admin.from('team_coaches').select('team_id').eq('coach_id', account.ownerProfileId)
  if (error) throw new AccountContextError('Impossibile verificare le squadre assegnate', 500)
  return { admin, coachId: account.ownerProfileId, teamIds: new Set((data ?? []).map((row) => row.team_id as string)) }
}

async function authorizeGroup(context: CoachMutationContext, groupId: string) {
  const { data, error } = await context.admin
    .from('championship_group_teams')
    .select('championship_club_teams(team_id)')
    .eq('championship_group_id', groupId)
  if (error) throw new AccountContextError('Impossibile verificare il girone', 500)
  const allowed = (data ?? []).some((row) => {
    const relation = Array.isArray(row.championship_club_teams) ? row.championship_club_teams[0] : row.championship_club_teams
    return relation?.team_id && context.teamIds.has(relation.team_id as string)
  })
  if (!allowed) throw new AccountContextError('Girone non autorizzato per il coach', 403)
}

async function authorizeMatch(context: CoachMutationContext, matchId: string) {
  const { data, error } = await context.admin.from('championship_matches').select('championship_group_id').eq('id', matchId).maybeSingle()
  if (error) throw new AccountContextError('Impossibile verificare la partita', 500)
  if (!data) throw new AccountContextError('Partita non trovata', 404)
  await authorizeGroup(context, data.championship_group_id as string)
  return data.championship_group_id as string
}

async function authorizeChampionship(context: CoachMutationContext, championshipId: string) {
  const { data, error } = await context.admin.from('championship_groups').select('id').eq('championship_id', championshipId)
  if (error) throw new AccountContextError('Impossibile verificare il campionato', 500)
  for (const group of data ?? []) {
    try {
      await authorizeGroup(context, group.id as string)
      return
    } catch (error) {
      if (!(error instanceof AccountContextError) || error.status !== 403) throw error
    }
  }
  throw new AccountContextError('Campionato non autorizzato per il coach', 403)
}

async function authorizeChampionshipSetup(context: CoachMutationContext, championshipId: string) {
  try {
    await authorizeChampionship(context, championshipId)
    return
  } catch (error) {
    if (!(error instanceof AccountContextError) || error.status !== 403) throw error
  }
  const { data: groups, error } = await context.admin.from('championship_groups').select('id').eq('championship_id', championshipId)
  if (error || !groups?.length) throw new AccountContextError('Campionato non autorizzato per il coach', 403)
  const { data: groupTeams, error: groupTeamsError } = await context.admin.from('championship_group_teams').select('id').in('championship_group_id', groups.map((group) => group.id))
  if (groupTeamsError || (groupTeams ?? []).length > 0) throw new AccountContextError('Campionato non autorizzato per il coach', 403)
}

async function handleMutation(context: CoachMutationContext, body: Record<string, unknown>) {
  const action = body.action
  if (action === 'create_championship') {
    if (context.teamIds.size === 0) throw new AccountContextError('Nessuna squadra assegnata al coach', 403)
    const { data: championship, error } = await context.admin.from('championships').insert({
      name: body.name,
      sport: body.sport,
      status: body.status,
      season_id: body.season_id,
      activity_id: body.activity_id || null,
      start_date: body.start_date || null,
      end_date: body.end_date || null,
    }).select('id').single()
    if (error) throw new Error('Impossibile creare il campionato')
    if (body.create_group && body.group_name) {
      const { error: groupError } = await context.admin.from('championship_groups').insert({ championship_id: championship.id, name: body.group_name, phase: 'regular', sort_order: 0 })
      if (groupError) throw new Error('Impossibile creare il girone')
    }
    return { id: championship.id }
  }

  if (action === 'create_group') {
    await authorizeChampionshipSetup(context, String(body.championship_id))
    const { error } = await context.admin.from('championship_groups').insert({ championship_id: body.championship_id, name: body.name, phase: body.phase, sort_order: body.sort_order })
    if (error) throw new Error('Impossibile creare il girone')
    return { ok: true }
  }

  if (action === 'match_info' || action === 'match_status') {
    await authorizeMatch(context, String(body.match_id))
    const update = action === 'match_info'
      ? { match_date: body.match_date || null, start_time: body.start_time ? `${body.start_time}:00` : null, location_text: body.location_text || null }
      : { status: body.status }
    const { error } = await context.admin.from('championship_matches').update(update).eq('id', body.match_id)
    if (error) throw new Error('Impossibile aggiornare la partita')
    return { ok: true }
  }

  if (action === 'match_result' || action === 'import_results') {
    const results = action === 'match_result' ? [{ matchId: String(body.match_id), sets: body.sets }] : body.results
    if (!Array.isArray(results)) throw new AccountContextError('Risultati non validi', 400)
    for (const result of results as Array<{ matchId: string; sets: Array<{ home: number; away: number }> }>) {
      await authorizeMatch(context, result.matchId)
      const { error: deleteError } = await context.admin.from('championship_match_sets').delete().eq('match_id', result.matchId)
      if (deleteError) throw new Error('Impossibile aggiornare i set')
      if (result.sets.length > 0) {
        const { error: insertError } = await context.admin.from('championship_match_sets').insert(result.sets.map((set, index) => ({ match_id: result.matchId, set_number: index + 1, home_points: set.home, away_points: set.away })))
        if (insertError) throw new Error('Impossibile salvare i set')
      }
      const { error: statusError } = await context.admin.from('championship_matches').update({ status: result.sets.length > 0 ? 'completed' : 'scheduled' }).eq('id', result.matchId)
      if (statusError) throw new Error('Impossibile aggiornare lo stato partita')
    }
    return { ok: true }
  }

  if (action === 'save_convocation') {
    if (!context.teamIds.has(String(body.team_id))) throw new AccountContextError('Squadra non assegnata al coach', 403)
    await authorizeMatch(context, String(body.match_id))
    const { data: clubTeam } = await context.admin.from('championship_club_teams').select('team_id').eq('id', body.club_team_id).maybeSingle()
    if (!clubTeam || clubTeam.team_id !== body.team_id) throw new AccountContextError('Squadra campionato non autorizzata', 403)
    const members = Array.isArray(body.members) ? body.members as Array<{ team_member_id: string; profile_id?: string | null }> : []
    if (members.length) {
      const { data: teamMembers, error: membersError } = await context.admin.from('team_members').select('id, profile_id').eq('team_id', body.team_id).in('id', members.map((member) => member.team_member_id))
      if (membersError) throw new Error('Impossibile verificare i convocati')
      if ((teamMembers ?? []).length !== members.length) throw new AccountContextError('Atleta non appartenente alla squadra assegnata', 403)
    }
    const { data: convocation, error } = await context.admin.from('championship_match_convocations').upsert({ id: body.convocation_id, match_id: body.match_id, championship_club_team_id: body.club_team_id, team_id: body.team_id }, { onConflict: 'match_id,championship_club_team_id' }).select('id').single()
    if (error) throw new Error('Impossibile salvare la convocazione')
    const { error: deleteError } = await context.admin.from('championship_match_convocation_members').delete().eq('convocation_id', convocation.id)
    if (deleteError) throw new Error('Impossibile aggiornare i destinatari')
    if (members.length) {
      const { error: insertError } = await context.admin.from('championship_match_convocation_members').insert(members.map((member) => ({ convocation_id: convocation.id, team_member_id: member.team_member_id, profile_id: member.profile_id || null })))
      if (insertError) throw new Error('Impossibile salvare i destinatari')
    }
    return { ok: true }
  }

  if (action === 'add_club_team') {
    await authorizeChampionshipSetup(context, String(body.championship_id))
    if (body.team_id && !context.teamIds.has(String(body.team_id))) throw new AccountContextError('Squadra non assegnata al coach', 403)
    const { data, error } = await context.admin.from('championship_club_teams').upsert({ championship_id: body.championship_id, code: body.code, name: body.name, is_home_club: body.is_home_club, team_id: body.team_id || null }, { onConflict: 'championship_id,code' }).select('id, code, name, is_home_club, team_id').single()
    if (error) throw new Error('Impossibile creare la squadra campionato')
    return data
  }

  if (action === 'save_group_teams') {
    await authorizeGroup(context, String(body.group_id))
    const selected = Array.isArray(body.selected) ? body.selected as Array<{ club_team_id: string; is_home_club: boolean }> : []
    const ids = selected.map((entry) => entry.club_team_id)
    if (ids.length) {
      const { data: clubs, error } = await context.admin.from('championship_club_teams').select('id, team_id').in('id', ids)
      if (error) throw new Error('Impossibile verificare le squadre campionato')
      if ((clubs ?? []).some((club) => club.team_id && !context.teamIds.has(club.team_id as string))) throw new AccountContextError('Squadra non assegnata al coach', 403)
      const { error: upsertError } = await context.admin.from('championship_group_teams').upsert(selected.map((entry) => ({ championship_group_id: body.group_id, championship_club_team_id: entry.club_team_id, is_home_club: entry.is_home_club })), { onConflict: 'championship_group_id,championship_club_team_id' })
      if (upsertError) throw new Error('Impossibile aggiornare le squadre del girone')
    }
    const current = await context.admin.from('championship_group_teams').select('championship_club_team_id').eq('championship_group_id', body.group_id)
    const selectedIds = new Set(ids)
    const toDelete = (current.data ?? []).map((entry) => entry.championship_club_team_id as string).filter((id) => !selectedIds.has(id))
    if (toDelete.length) await context.admin.from('championship_group_teams').delete().eq('championship_group_id', body.group_id).in('championship_club_team_id', toDelete)
    return { ok: true }
  }

  if (action === 'import_matches') {
    await authorizeGroup(context, String(body.group_id))
    const matches = Array.isArray(body.matches) ? body.matches : []
    if (!matches.length) throw new AccountContextError('Nessuna partita da importare', 400)
    const { error } = await context.admin.from('championship_matches').upsert(matches, { onConflict: 'championship_group_id,match_day,home_club_team_id,away_club_team_id' })
    if (error) throw new Error('Impossibile importare il calendario')
    const clubTeamIds = Array.isArray(body.group_club_team_ids) ? body.group_club_team_ids.map(String) : []
    if (clubTeamIds.length) {
      const { error: groupTeamsError } = await context.admin.from('championship_group_teams').upsert(clubTeamIds.map((championship_club_team_id) => ({ championship_group_id: body.group_id, championship_club_team_id })), { onConflict: 'championship_group_id,championship_club_team_id' })
      if (groupTeamsError) throw new Error('Impossibile associare le squadre al girone')
    }
    return { ok: true }
  }

  if (action === 'delete_calendar') {
    const groupIds = Array.isArray(body.group_ids) ? body.group_ids.map(String) : []
    if (!groupIds.length) throw new AccountContextError('Nessun girone da cancellare', 400)
    for (const groupId of groupIds) await authorizeGroup(context, groupId)
    const { data: matches, error: matchesError } = await context.admin.from('championship_matches').select('id, event_id').in('championship_group_id', groupIds)
    if (matchesError) throw new Error('Impossibile leggere le partite')
    const matchIds = (matches ?? []).map((match) => match.id as string)
    const eventIds = (matches ?? []).map((match) => match.event_id as string | null).filter(Boolean) as string[]
    if (eventIds.length) { await context.admin.from('event_teams').delete().in('event_id', eventIds); await context.admin.from('events').delete().in('id', eventIds) }
    if (matchIds.length) await context.admin.from('championship_match_sets').delete().in('match_id', matchIds)
    await context.admin.from('championship_matches').delete().in('championship_group_id', groupIds)
    await context.admin.from('championship_group_teams').delete().in('championship_group_id', groupIds)
    await context.admin.from('championship_groups').delete().in('id', groupIds)
    if (body.scope === 'championship' && body.championship_id) {
      await context.admin.from('championship_club_teams').delete().eq('championship_id', body.championship_id)
      await context.admin.from('championships').delete().eq('id', body.championship_id)
    }
    return { ok: true }
  }

  throw new AccountContextError('Mutation coach non riconosciuta', 400)
}

export async function POST(request: NextRequest) {
  try {
    const context = await getContext()
    const body = await request.json() as Record<string, unknown>
    return NextResponse.json(await handleMutation(context, body))
  } catch (error) {
    if (error instanceof AccountContextError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Coach championship mutation error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}
