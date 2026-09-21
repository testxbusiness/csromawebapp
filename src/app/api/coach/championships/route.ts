import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { AccountContextError, requireAccountContext } from '@/server/auth/require-account-context'
import { noStoreJson } from '@/server/http/no-store'
import { resolveActiveSeason, resolveActiveSeasonTeamIds } from '@/server/seasons/active-season'

const uuid = z.string().uuid()
const querySchema = z.object({
  view: z.enum(['catalog', 'group', 'club-teams']).default('catalog'),
  groupId: uuid.optional(),
  championshipId: uuid.optional(),
})

type CoachChampionshipContext = {
  admin: ReturnType<typeof createAdminClient>
  activeSeason: { id: string; name: string }
  teamIds: Set<string>
}

function firstRelation<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined
}

async function resolveCoachContext(): Promise<CoachChampionshipContext> {
  const client = await createClient()
  const account = await requireAccountContext(client)
  if (!account.roles.includes('coach')) throw new AccountContextError('Ruolo coach non abilitato', 403)

  const activeSeason = await resolveActiveSeason(client)
  if (!activeSeason) throw new AccountContextError('Nessuna stagione attiva configurata', 403)

  const activeTeamIds = new Set(await resolveActiveSeasonTeamIds(client, activeSeason.id))
  const admin = createAdminClient()
  const { data: assignments, error } = await admin
    .from('team_coaches')
    .select('team_id')
    .eq('coach_id', account.ownerProfileId)
  if (error) throw new AccountContextError('Impossibile verificare le squadre assegnate', 500)

  return {
    admin,
    activeSeason,
    teamIds: new Set((assignments ?? [])
      .map((assignment) => assignment.team_id as string)
      .filter((teamId) => activeTeamIds.has(teamId))),
  }
}

async function authorizeGroup(context: CoachChampionshipContext, groupId: string) {
  const { data: group, error } = await context.admin
    .from('championship_groups')
    .select(`
      id, championship_id,
      championships!inner(season_id),
      championship_group_teams(championship_club_teams(team_id))
    `)
    .eq('id', groupId)
    .maybeSingle()
  if (error) throw new AccountContextError('Impossibile verificare il girone', 500)
  const championship = firstRelation(group?.championships)
  const authorized = championship?.season_id === context.activeSeason.id
    && (group?.championship_group_teams ?? []).some((groupTeam) => {
      const clubTeam = firstRelation(groupTeam.championship_club_teams)
      return Boolean(clubTeam?.team_id && context.teamIds.has(clubTeam.team_id as string))
    })
  if (!group || !authorized) throw new AccountContextError('Girone non autorizzato per il coach', 403)
  return group
}

async function authorizeChampionship(context: CoachChampionshipContext, championshipId: string) {
  const { data: groups, error } = await context.admin
    .from('championship_groups')
    .select('id')
    .eq('championship_id', championshipId)
  if (error) throw new AccountContextError('Impossibile verificare il campionato', 500)
  for (const group of groups ?? []) {
    try {
      await authorizeGroup(context, group.id as string)
      return
    } catch (error) {
      if (!(error instanceof AccountContextError) || error.status !== 403) throw error
    }
  }
  throw new AccountContextError('Campionato non autorizzato per il coach', 403)
}

async function loadClubTeams(context: CoachChampionshipContext, championshipId: string) {
  await authorizeChampionship(context, championshipId)
  const { data, error } = await context.admin
    .from('championship_club_teams')
    .select('id, championship_id, code, name, is_home_club, team_id, teams(id, name, code)')
    .eq('championship_id', championshipId)
    .order('name')
  if (error) throw new AccountContextError('Impossibile caricare le squadre del campionato', 500)
  return data ?? []
}

async function loadCatalog(context: CoachChampionshipContext) {
  if (context.teamIds.size === 0) {
    return {
      seasons: [context.activeSeason],
      activities: [],
      teams: [],
      championships: [],
    }
  }

  const teamIds = [...context.teamIds]
  const [{ data: teams, error: teamsError }, { data: activities, error: activitiesError }, { data: championships, error: championshipsError }] = await Promise.all([
    context.admin.from('teams').select('id, name, code').in('id', teamIds).order('name'),
    context.admin.from('activities').select('id, name, season_id').eq('season_id', context.activeSeason.id).order('name'),
    context.admin
      .from('championships')
      .select(`
        id, name, status, sport, start_date, end_date,
        championship_groups(
          id, name, phase, sort_order,
          championship_group_teams(
            id, championship_club_team_id, is_home_club,
            championship_club_teams(id, code, name, is_home_club, team_id, teams(id, name, code))
          )
        )
      `)
      .eq('season_id', context.activeSeason.id)
      .order('created_at', { ascending: false })
      .order('sort_order', { referencedTable: 'championship_groups', ascending: true }),
  ])
  if (teamsError || activitiesError || championshipsError) {
    throw new AccountContextError('Impossibile caricare i campionati del coach', 500)
  }

  const visibleChampionships = (championships ?? []).flatMap((championship) => {
    const visibleGroups = (championship.championship_groups ?? []).filter((group) =>
      (group.championship_group_teams ?? []).some((groupTeam) => {
        const clubTeam = firstRelation(groupTeam.championship_club_teams)
        return Boolean(clubTeam?.team_id && context.teamIds.has(clubTeam.team_id as string))
      }),
    )
    return visibleGroups.length > 0 ? [{ ...championship, championship_groups: visibleGroups }] : []
  })

  return {
    seasons: [context.activeSeason],
    activities: activities ?? [],
    teams: teams ?? [],
    championships: visibleChampionships,
  }
}

async function loadGroup(context: CoachChampionshipContext, groupId: string) {
  await authorizeGroup(context, groupId)
  const [{ data: matches, error: matchesError }, { data: standings, error: standingsError }, { data: groupTeams, error: groupTeamsError }] = await Promise.all([
    context.admin
      .from('championship_matches')
      .select(`
        id, match_day, round_label, match_date, start_time, status, location_text, event_id,
        home_club_team_id, away_club_team_id,
        championship_match_sets(id, set_number, home_points, away_points),
        home_club_team:home_club_team_id(id, code, name, is_home_club, team_id, teams(id, name, code)),
        away_club_team:away_club_team_id(id, code, name, is_home_club, team_id, teams(id, name, code))
      `)
      .eq('championship_group_id', groupId)
      .order('match_day', { ascending: true })
      .order('match_date', { ascending: true }),
    context.admin.from('championship_standings_mv').select('*').eq('championship_group_id', groupId),
    context.admin
      .from('championship_group_teams')
      .select('championship_club_team_id, championship_club_teams(id, name)')
      .eq('championship_group_id', groupId),
  ])
  if (matchesError || standingsError || groupTeamsError) {
    throw new AccountContextError('Impossibile caricare i dettagli del girone', 500)
  }

  const teamLabels = new Map((groupTeams ?? []).map((entry) => {
    const clubTeam = firstRelation(entry.championship_club_teams)
    return [entry.championship_club_team_id as string, clubTeam?.name ?? null] as const
  }))
  return {
    matches: matches ?? [],
    standings: (standings ?? []).map((standing) => ({
      ...standing,
      team_name: teamLabels.get(standing.club_team_id as string) ?? null,
    })),
  }
}

export async function GET(request: NextRequest) {
  try {
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()))
    if (!parsed.success) return noStoreJson({ error: 'Parametri campionato non validi' }, 400)
    if (parsed.data.view === 'group' && !parsed.data.groupId) return noStoreJson({ error: 'groupId obbligatorio' }, 400)
    if (parsed.data.view === 'club-teams' && !parsed.data.championshipId) return noStoreJson({ error: 'championshipId obbligatorio' }, 400)

    const context = await resolveCoachContext()
    if (parsed.data.view === 'group') return noStoreJson(await loadGroup(context, parsed.data.groupId!))
    if (parsed.data.view === 'club-teams') {
      return noStoreJson({ clubTeams: await loadClubTeams(context, parsed.data.championshipId!) })
    }
    return noStoreJson(await loadCatalog(context))
  } catch (error) {
    if (error instanceof AccountContextError) return noStoreJson({ error: error.message }, error.status)
    console.error('Errore endpoint campionati coach:', error)
    return noStoreJson({ error: 'Errore interno del server' }, 500)
  }
}
