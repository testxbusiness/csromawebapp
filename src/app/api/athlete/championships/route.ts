import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { resolveAthleteChampionshipContext, type AthleteChampionship } from '@/server/championships/resolve-athlete-championship'
import { noStoreJson } from '@/server/http/no-store'

const uuid = z.string().uuid()
const querySchema = z.object({
  view: z.enum(['catalog', 'group', 'convocation']).default('catalog'),
  subjectProfileId: uuid.nullable().optional(),
  groupId: uuid.nullable().optional(),
  matchId: uuid.nullable().optional(),
  clubTeamId: uuid.nullable().optional(),
})

type GroupTeamLabelRow = {
  championship_club_team_id: string
  championship_club_teams?: { id: string; name: string; code?: string | null } | { id: string; name: string; code?: string | null }[] | null
}

function firstRelation<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined
}

function jsonError(error: unknown) {
  if (error instanceof AccountContextError) {
    return noStoreJson({ error: error.message }, error.status)
  }
  console.error('Errore endpoint campionati atleta:', error)
  return noStoreJson({ error: 'Errore interno del server' }, 500)
}

function findAuthorizedGroup(
  championships: AthleteChampionship[],
  groupId: string,
) {
  for (const championship of championships) {
    const group = championship.groups.find((candidate) => candidate.id === groupId)
    if (group) return { championship, group }
  }
  return null
}

export async function GET(request: NextRequest) {
  try {
    const raw = Object.fromEntries(new URL(request.url).searchParams.entries())
    const parsed = querySchema.safeParse(raw)
    if (!parsed.success) {
      return noStoreJson({ error: 'Parametri campionato non validi' }, 400)
    }

    const { view, subjectProfileId, groupId, matchId, clubTeamId } = parsed.data
    if (view === 'group' && !groupId) {
      return noStoreJson({ error: 'groupId obbligatorio' }, 400)
    }
    if (view === 'convocation' && (!matchId || !clubTeamId)) {
      return noStoreJson({ error: 'matchId e clubTeamId obbligatori' }, 400)
    }

    const supabase = await createClient()
    const resolved = await resolveAthleteChampionshipContext(supabase, subjectProfileId ?? null)
    const { dataClient, account: _account, permissions: _permissions, delegated: _delegated, ...context } = resolved
    if (view === 'catalog') {
      return noStoreJson(context)
    }

    if (view === 'group') {
      const authorizedGroup = findAuthorizedGroup(context.championships, groupId!)
      if (!authorizedGroup) {
        return noStoreJson({ error: 'Girone non autorizzato per il soggetto' }, 403)
      }

      const { data: matches, error: matchesError } = await dataClient
        .from('championship_matches')
        .select(`
          id, match_day, round_label, match_date, start_time, status, location_text, event_id,
          home_club_team_id, away_club_team_id,
          championship_match_sets ( id, set_number, home_points, away_points ),
          home_club_team:home_club_team_id ( id, code, name, is_home_club, team_id, teams ( id, name, code ) ),
          away_club_team:away_club_team_id ( id, code, name, is_home_club, team_id, teams ( id, name, code ) )
        `)
        .eq('championship_group_id', groupId!)
        .order('match_day', { ascending: true })
        .order('match_date', { ascending: true })
      if (matchesError) throw new AccountContextError('Impossibile caricare le partite del girone', 500)

      // The materialized view has no RLS and is intentionally inaccessible to
      // authenticated Data API clients. Authorization is complete above, so
      // read only the selected group through the server-side admin client.
      const adminClient = createAdminClient()
      const [{ data: standings, error: standingsError }, { data: groupTeamLabels, error: groupTeamLabelsError }] = await Promise.all([
        adminClient
        .from('championship_standings_mv')
        .select('*')
        .eq('championship_group_id', groupId!),
        adminClient
          .from('championship_group_teams')
          .select('championship_club_team_id, championship_club_teams(id, name, code)')
          .eq('championship_group_id', groupId!),
      ])
      if (standingsError) throw new AccountContextError('Impossibile caricare la classifica del girone', 500)
      if (groupTeamLabelsError) throw new AccountContextError('Impossibile caricare i nomi delle squadre del girone', 500)

      const teamLabels = new Map(
        (groupTeamLabels ?? [] as GroupTeamLabelRow[]).map((entry) => {
          const clubTeam = firstRelation(entry.championship_club_teams)
          return [entry.championship_club_team_id, clubTeam?.name ?? null] as const
        }),
      )

      return noStoreJson({
        subjectProfileId: context.subjectProfileId,
        championship: authorizedGroup.championship,
        group: authorizedGroup.group,
        matches: matches ?? [],
        standings: (standings ?? []).map((standing: { club_team_id?: string }) => ({
          ...standing,
          team_name: standing.club_team_id ? teamLabels.get(standing.club_team_id) ?? null : null,
        })),
      })
    }

    const { data: match, error: matchError } = await dataClient
      .from('championship_matches')
      .select('id, championship_group_id, home_club_team_id, away_club_team_id')
      .eq('id', matchId!)
      .maybeSingle()
    if (matchError) throw new AccountContextError('Impossibile verificare la partita', 500)
    const authorizedGroup = match
      ? findAuthorizedGroup(context.championships, match.championship_group_id)
      : null
    const clubTeam = authorizedGroup?.championship.clubTeams.find((candidate) => candidate.id === clubTeamId)
    if (!match || !authorizedGroup || !clubTeam || !authorizedGroup.group.clubTeamIds.includes(clubTeam.id)
      || ![match.home_club_team_id, match.away_club_team_id].includes(clubTeam.id)) {
      return noStoreJson({ error: 'Partita non autorizzata per la squadra' }, 403)
    }

    const { data: convocation, error: convocationError } = await dataClient
      .from('championship_match_convocations')
      .select(`
        id, match_id, championship_club_team_id, team_id, notes,
        championship_club_teams ( id, name, is_home_club, team_id ),
        championship_match_convocation_members (
          team_member_id, profile_id,
          profiles ( first_name, last_name ),
          team_members ( profile_id, jersey_number, profiles ( first_name, last_name ) )
        )
      `)
      .eq('match_id', matchId!)
      .eq('championship_club_team_id', clubTeam.id)
      .maybeSingle()
    if (convocationError && convocationError.code !== 'PGRST116') {
      throw new AccountContextError('Impossibile caricare la convocazione', 500)
    }

    return noStoreJson({
      subjectProfileId: context.subjectProfileId,
      matchId,
      clubTeamId: clubTeam.id,
      convocation: convocation ?? null,
    })
  } catch (error) {
    return jsonError(error)
  }
}
