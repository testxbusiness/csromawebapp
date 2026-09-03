import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireSubjectAthleteContext } from '@/server/auth/require-subject-profile'

type TeamRow = {
  team_id: string
  created_at?: string | null
  teams?: { id: string; name: string; code?: string | null } | { id: string; name: string; code?: string | null }[] | null
}

type ClubTeamRow = {
  id: string
  championship_id: string
  team_id: string | null
  code: string
  name: string
  is_home_club: boolean
}

type GroupTeamRow = {
  id: string
  championship_group_id: string
  championship_club_team_id: string
}

type ChampionshipRow = {
  id: string
  name: string
  status: string
  sport: string
  start_date?: string | null
  end_date?: string | null
}

type GroupRow = {
  id: string
  championship_id: string
  name: string
  phase: string
  sort_order: number
}

export type AthleteChampionshipTeam = {
  id: string
  name: string
  code?: string | null
}

export type AthleteChampionshipClubTeam = ClubTeamRow

export type AthleteChampionshipGroup = GroupRow & {
  clubTeamIds: string[]
}

export type AthleteChampionship = ChampionshipRow & {
  teamIds: string[]
  clubTeams: AthleteChampionshipClubTeam[]
  groups: AthleteChampionshipGroup[]
}

export type AthleteChampionshipSelection = {
  teamId: string
  championshipId: string
  groupId: string
}

export type AthleteChampionshipResolution = {
  subjectProfileId: string
  teams: AthleteChampionshipTeam[]
  championships: AthleteChampionship[]
  /** Every authorized team→championship→group path for the subject. */
  paths: AthleteChampionshipSelection[]
  /** Set only when the authorized graph contains one unambiguous path. */
  initialSelection: AthleteChampionshipSelection | null
}

function relation<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined
}

function throwQueryError(message: string): never {
  throw new AccountContextError(message, 500)
}

/**
 * Resolves the athlete championship graph from an already authorized subject.
 * The caller must not provide a team/championship as an authorization shortcut.
 */
export async function resolveAthleteChampionshipsForSubject(
  dataClient: SupabaseClient,
  subjectProfileId: string,
): Promise<AthleteChampionshipResolution> {
  const { data: membershipRows, error: membershipError } = await dataClient
    .from('team_members')
    .select('team_id, created_at, teams(id, name, code)')
    .eq('profile_id', subjectProfileId)
    .eq('role', 'athlete')
    .order('created_at', { ascending: true })

  if (membershipError) throwQueryError('Impossibile risolvere le squadre dell’atleta')

  const memberships = (membershipRows ?? []) as TeamRow[]
  const teams: AthleteChampionshipTeam[] = memberships
    .map((row) => relation(row.teams))
    .filter((team): team is AthleteChampionshipTeam => Boolean(team?.id))
    .filter((team, index, values) => values.findIndex((candidate) => candidate.id === team.id) === index)
  const teamIds = teams.map((team) => team.id)
  if (teamIds.length === 0) {
    return { subjectProfileId, teams: [], championships: [], paths: [], initialSelection: null }
  }

  const { data: clubTeamRows, error: clubTeamError } = await dataClient
    .from('championship_club_teams')
    .select('id, championship_id, team_id, code, name, is_home_club')
    .in('team_id', teamIds)

  if (clubTeamError) throwQueryError('Impossibile risolvere le squadre dei campionati')

  const clubTeams = (clubTeamRows ?? []) as ClubTeamRow[]
  const championshipIds = [...new Set(clubTeams.map((row) => row.championship_id))]
  if (championshipIds.length === 0) {
    return { subjectProfileId, teams, championships: [], paths: [], initialSelection: null }
  }

  const [{ data: championshipRows, error: championshipError }, { data: groupRows, error: groupError }] = await Promise.all([
    dataClient
      .from('championships')
      .select('id, name, status, sport, start_date, end_date')
      .in('id', championshipIds),
    dataClient
      .from('championship_groups')
      .select('id, championship_id, name, phase, sort_order')
      .in('championship_id', championshipIds)
      .order('sort_order', { ascending: true }),
  ])

  if (championshipError) throwQueryError('Impossibile risolvere i campionati dell’atleta')
  if (groupError) throwQueryError('Impossibile risolvere i gironi dell’atleta')

  const groups = (groupRows ?? []) as GroupRow[]
  const groupIds = groups.map((group) => group.id)
  const { data: groupTeamRows, error: groupTeamError } = groupIds.length
    ? await dataClient
      .from('championship_group_teams')
      .select('id, championship_group_id, championship_club_team_id')
      .in('championship_group_id', groupIds)
    : { data: [], error: null }

  if (groupTeamError) throwQueryError('Impossibile risolvere le squadre dei gironi')

  const authorizedClubTeamIds = new Set(clubTeams.map((clubTeam) => clubTeam.id))
  const groupTeams = (groupTeamRows ?? []) as GroupTeamRow[]
  const groupsByChampionship = new Map<string, AthleteChampionshipGroup[]>()
  for (const group of groups) {
    const clubTeamIds = groupTeams
      .filter((entry) => entry.championship_group_id === group.id && authorizedClubTeamIds.has(entry.championship_club_team_id))
      .map((entry) => entry.championship_club_team_id)
    if (clubTeamIds.length > 0) {
      const current = groupsByChampionship.get(group.championship_id) ?? []
      current.push({ ...group, clubTeamIds })
      groupsByChampionship.set(group.championship_id, current)
    }
  }

  const championships = ((championshipRows ?? []) as ChampionshipRow[])
    .map((championship) => {
      const relatedGroups = groupsByChampionship.get(championship.id) ?? []
      const relatedGroupClubTeamIds = new Set(relatedGroups.flatMap((group) => group.clubTeamIds))
      const relatedClubTeams = clubTeams.filter((clubTeam) =>
        clubTeam.championship_id === championship.id && relatedGroupClubTeamIds.has(clubTeam.id),
      )
      return {
        ...championship,
        teamIds: [...new Set(relatedClubTeams.map((clubTeam) => clubTeam.team_id).filter((id): id is string => Boolean(id)))],
        clubTeams: relatedClubTeams,
        groups: relatedGroups,
      }
    })
    .filter((championship) => championship.groups.length > 0)

  const paths = [...new Map(
    championships
      .flatMap((championship) => championshipsForSelection(championship, teamIds))
      .map((path) => [`${path.teamId}:${path.championshipId}:${path.groupId}`, path] as const),
  ).values()]
  return {
    subjectProfileId,
    teams,
    championships,
    paths,
    initialSelection: paths.length === 1 ? paths[0] : null,
  }
}

function championshipsForSelection(
  championship: AthleteChampionship,
  teamIds: string[],
): AthleteChampionshipSelection[] {
  return championship.groups.flatMap((group) => group.clubTeamIds
    .map((clubTeamId) => championship.clubTeams.find((clubTeam) => clubTeam.id === clubTeamId)?.team_id)
    .filter((teamId): teamId is string => typeof teamId === 'string' && teamIds.includes(teamId))
    .map((teamId) => ({ teamId, championshipId: championship.id, groupId: group.id })))
}

export async function resolveAthleteChampionshipContext(
  supabase: SupabaseClient,
  requestedProfileId: string | null,
) {
  const subject = await requireSubjectAthleteContext(supabase, requestedProfileId, 'view_schedule')
  const resolution = await resolveAthleteChampionshipsForSubject(subject.dataClient, subject.profileId)
  return { ...subject, ...resolution }
}
