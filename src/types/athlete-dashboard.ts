export interface AthleteDashboardTeam {
  id: string
  name: string
  code: string
  activity?: { id?: string; name: string } | null
}

export interface AthleteDashboardEventTeam extends AthleteDashboardTeam {}

export interface AthleteDashboardMessageTeam extends AthleteDashboardTeam {}

export interface AthleteDashboardContract {
  teamMemberships: unknown[]
  upcomingEvents: unknown[]
  nextChampionshipMatch: unknown | null
  unreadMessages: unknown[]
  feeInstallments: unknown[]
  activeSeason: unknown | null
  /** Additive index for selectors; legacy consumers can ignore it. */
  teams: AthleteDashboardTeam[]
  unreadMessageCount: number
}
