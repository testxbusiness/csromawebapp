export type ClubTeam = {
  id: string
  code: string
  name: string
  is_home_club: boolean
  team_id?: string | null
  teams?: {
    id: string
    name: string
    code?: string | null
  }[] | null
}

export type GroupTeam = {
  id: string
  championship_club_team_id: string
  is_home_club: boolean
  championship_club_teams?: ClubTeam
}

export type ChampionshipGroup = {
  id: string
  name: string
  phase: string
  sort_order: number
  championship_group_teams?: GroupTeam[]
}

export type Championship = {
  id: string
  name: string
  status: string
  sport: string
  start_date?: string | null
  end_date?: string | null
  team_ids?: string[]
  /** Club-team labels already scoped by the server-side athlete resolver. */
  clubTeams?: ClubTeam[]
  championship_groups?: ChampionshipGroup[]
}

export type MatchSet = {
  id?: string
  set_number: number
  home_points: number
  away_points: number
}

export type Match = {
  id: string
  match_day: number | null
  round_label?: string | null
  match_date?: string | null
  start_time?: string | null
  status: string
  location_text?: string | null
  event_id?: string | null
  home_club_team_id: string
  away_club_team_id: string
  championship_match_sets?: MatchSet[]
  home_club_team?: ClubTeam
  away_club_team?: ClubTeam
}

export type ConvocationMember = {
  team_member_id: string
  profile_id?: string | null
  profiles?: { first_name?: string | null; last_name?: string | null } | null
  team_members?: {
    jersey_number?: number | null
    profile_id?: string | null
    profiles?: { first_name?: string | null; last_name?: string | null } | null
  } | null
}

export type Convocation = {
  id?: string
  match_id: string
  championship_club_team_id: string
  team_id?: string | null
  notes?: string | null
  championship_match_convocation_members?: ConvocationMember[]
  championship_club_teams?: ClubTeam
}

export type TeamMember = {
  id: string
  profile_id: string
  jersey_number?: number | null
  profiles?: { first_name?: string | null; last_name?: string | null } | null
}

export type Standing = {
  championship_group_id: string
  club_team_id: string
  matches_played: number
  wins: number
  losses: number
  sets_for: number
  sets_against: number
  points_for: number
  points_against: number
  class_points: number
  set_ratio: number | null
  point_ratio: number | null
  /** Server-enriched label for teams in the selected group. */
  team_name?: string | null
}

export type Season = { id: string; name: string }
export type Activity = { id: string; name: string; season_id: string }
export type Team = { id: string; name: string; code?: string | null }
export type ClubTeamOption = ClubTeam
export type ManagerMode = 'admin' | 'coach' | 'athlete'

export const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Programmato',
  completed: 'Concluso',
  postponed: 'Rinviato',
  cancelled: 'Cancellato',
  forfeit: 'Forfait',
}

export function firstRelation<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined
}
