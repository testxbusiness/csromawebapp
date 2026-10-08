import { useQuery } from '@tanstack/react-query'
import { useAccessibleProfilesOptional } from '@/context/AccessibleProfileContext'
import { useAuthOptional } from '@/hooks/useAuth'
import { requestErrorState, type RequestState } from '@/lib/http/request-state'
import { athleteKeys } from '@/lib/query-keys'
import { firstRelation, type Activity, type Championship, type Match, type Season, type Standing, type Team } from '@/components/championship/types'

type AthleteChampionshipCatalog = {
  championships: Championship[]
  seasons: Season[]
  activities: Activity[]
  teams: Team[]
}

type AthleteChampionshipGroup = {
  matches: Match[]
  standings: Standing[]
}

export class AthleteChampionshipQueryError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'AthleteChampionshipQueryError'
    this.status = status
  }
}

function normalizeCatalog(payload: Record<string, unknown> | null): AthleteChampionshipCatalog {
  const rawTeams = Array.isArray(payload?.teams) ? payload.teams as Array<{ id: string; name: string; code?: string | null }> : []
  const teams = rawTeams as Team[]
  const teamById = new Map(teams.map((team) => [team.id, team]))
  const rawChampionships = Array.isArray(payload?.championships) ? payload.championships as Array<Record<string, unknown>> : []
  const championships = rawChampionships.map((championship) => {
    const clubTeams = Array.isArray(championship.clubTeams) ? championship.clubTeams as Array<Record<string, unknown>> : []
    const groups = Array.isArray(championship.groups) ? championship.groups as Array<Record<string, unknown>> : []
    return {
      id: String(championship.id),
      name: String(championship.name),
      status: String(championship.status),
      sport: String(championship.sport),
      start_date: championship.start_date as string | null | undefined,
      end_date: championship.end_date as string | null | undefined,
      team_ids: Array.isArray(championship.teamIds) ? championship.teamIds as string[] : [],
      clubTeams: clubTeams.map((clubTeam) => ({
        id: String(clubTeam.id),
        championship_id: String(clubTeam.championship_id),
        code: String(clubTeam.code ?? ''),
        name: String(clubTeam.name),
        is_home_club: Boolean(clubTeam.is_home_club),
        team_id: clubTeam.team_id as string | null | undefined,
      })),
      championship_groups: groups.map((group) => {
        const clubTeamIds = Array.isArray(group.clubTeamIds) ? group.clubTeamIds as string[] : []
        return {
          id: String(group.id),
          name: String(group.name),
          phase: String(group.phase),
          sort_order: Number(group.sort_order ?? 0),
          championship_group_teams: clubTeamIds.map((clubTeamId) => {
            const clubTeam = clubTeams.find((candidate) => candidate.id === clubTeamId)
            const team = clubTeam?.team_id ? teamById.get(String(clubTeam.team_id)) : undefined
            return {
              id: `${String(group.id)}:${clubTeamId}`,
              championship_club_team_id: clubTeamId,
              is_home_club: Boolean(clubTeam?.is_home_club),
              championship_club_teams: clubTeam ? {
                id: String(clubTeam.id),
                championship_id: String(clubTeam.championship_id),
                code: String(clubTeam.code ?? ''),
                name: String(clubTeam.name),
                is_home_club: Boolean(clubTeam.is_home_club),
                team_id: clubTeam.team_id as string | null | undefined,
                teams: team ? [team] : [],
              } : undefined,
            }
          }),
        }
      }),
    } as Championship
  })
  return { championships, teams, seasons: [], activities: [] }
}

function normalizeGroup(payload: Record<string, unknown> | null): AthleteChampionshipGroup {
  const matches = (Array.isArray(payload?.matches) ? payload.matches : []).map((match) => {
    const raw = match as Record<string, unknown>
    return {
      ...raw,
      home_club_team: firstRelation(raw.home_club_team as Match['home_club_team'] | Match['home_club_team'][]),
      away_club_team: firstRelation(raw.away_club_team as Match['away_club_team'] | Match['away_club_team'][]),
    }
  }) as Match[]
  return { matches, standings: (Array.isArray(payload?.standings) ? payload.standings : []) as Standing[] }
}

async function fetchAthleteChampionship(input: { subjectProfileId: string | null; subjectProfileQueryParam: string | null; view: 'catalog' | 'group'; groupId?: string }, signal: AbortSignal): Promise<Record<string, unknown> | null> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new AthleteChampionshipQueryError('offline')
  const params = new URLSearchParams({ view: input.view })
  if (input.subjectProfileQueryParam) params.set('subjectProfileId', input.subjectProfileQueryParam)
  if (input.groupId) params.set('groupId', input.groupId)
  const response = await fetch(`/api/athlete/championships?${params.toString()}`, { cache: 'no-store', signal })
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null
  if (!response.ok) throw new AthleteChampionshipQueryError(response.status === 403 ? 'denied' : payload?.error as string ?? 'championship_fetch_failed', response.status)
  return payload
}

function useAthleteContext() {
  const auth = useAuthOptional()
  const accessibleProfiles = useAccessibleProfilesOptional()
  const account = auth?.account ?? null
  const role = auth?.role ?? null
  const user = auth?.user ?? null
  const authLoading = auth?.loading ?? false
  const profileLoading = auth?.profileLoading ?? false
  const activeArea = accessibleProfiles?.activeArea ?? 'personal'
  const selectedProfileId = accessibleProfiles?.selectedProfileId ?? null
  const accountId = account?.authUserId ?? user?.id ?? null
  const subjectProfileId = selectedProfileId ?? account?.ownerProfileId ?? null
  const subjectProfileQueryParam = activeArea === 'family' ? selectedProfileId : null
  const hasProviders = Boolean(auth || accessibleProfiles)
  return { accountId, role, subjectProfileId, subjectProfileQueryParam, enabled: !hasProviders || (!authLoading && !profileLoading && Boolean(user) && (role === 'athlete' || role === 'family_member') && Boolean(subjectProfileId) && (activeArea !== 'family' || Boolean(selectedProfileId)) ) }
}

export function useAthleteChampionshipCatalogQuery(enabled: boolean) {
  const context = useAthleteContext()
  const input = context.accountId && context.subjectProfileId ? { accountId: context.accountId, subjectProfileId: context.subjectProfileId, subjectProfileQueryParam: context.subjectProfileQueryParam } : null
  const queryKey = input ? athleteKeys.championships.catalog(input.accountId, input.subjectProfileId) : athleteKeys.championships.catalog('anonymous', 'unavailable')
  const query = useQuery<AthleteChampionshipCatalog, AthleteChampionshipQueryError>({
    queryKey,
    queryFn: async ({ signal }) => normalizeCatalog(await fetchAthleteChampionship({ subjectProfileId: input?.subjectProfileId ?? null, subjectProfileQueryParam: input?.subjectProfileQueryParam ?? null, view: 'catalog' }, signal)),
    enabled: enabled && context.enabled && Boolean(input),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
  return { ...query, status: query.isPending ? 'loading' as RequestState : query.error ? query.error.message === 'offline' ? 'offline' as RequestState : query.error.status === 403 ? 'denied' as RequestState : requestErrorState(query.error) : 'ready' as RequestState, reload: query.refetch }
}

export function useAthleteChampionshipGroupQuery(groupId: string | null, enabled: boolean) {
  const context = useAthleteContext()
  const input = context.accountId && context.subjectProfileId && groupId ? { accountId: context.accountId, subjectProfileId: context.subjectProfileId, subjectProfileQueryParam: context.subjectProfileQueryParam, groupId } : null
  const queryKey = input ? athleteKeys.championships.group(input.accountId, input.subjectProfileId, input.groupId) : athleteKeys.championships.group('anonymous', 'unavailable', groupId ?? 'unavailable')
  const query = useQuery<AthleteChampionshipGroup, AthleteChampionshipQueryError>({
    queryKey,
    queryFn: async ({ signal }) => normalizeGroup(await fetchAthleteChampionship({ subjectProfileId: input?.subjectProfileId ?? null, subjectProfileQueryParam: input?.subjectProfileQueryParam ?? null, view: 'group', groupId: input?.groupId }, signal)),
    enabled: enabled && context.enabled && Boolean(input),
    staleTime: 3 * 60 * 1000,
    retry: false,
  })
  return { ...query, status: !groupId ? 'ready' as RequestState : query.isPending ? 'loading' as RequestState : query.error ? query.error.message === 'offline' ? 'offline' as RequestState : query.error.status === 403 ? 'denied' as RequestState : requestErrorState(query.error) : 'ready' as RequestState, reload: query.refetch }
}
