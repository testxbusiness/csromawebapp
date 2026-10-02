import type { AttendanceAvailabilityContract } from '@/types/attendance'

export interface AthleteDashboardTeam {
  id: string
  name: string
  code: string
  activity?: { id?: string; name: string } | null
}

export interface AthleteDashboardEventTeam extends AthleteDashboardTeam {}

export interface AthleteDashboardMessageTeam extends AthleteDashboardTeam {}

export type AthleteDashboardAdministrativeAlert = {
  area: 'certificate' | 'fees'
  tone: 'danger' | 'warning'
  message: string
  href: '/athlete/fees?section=certificate' | '/athlete/fees?section=fees'
}

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
  /** Additive next-RSVP contract; legacy dashboard consumers can ignore it. */
  attendance_availability?: AttendanceAvailabilityContract | null
  /** At most one alert per authorized administrative area. */
  administrativeAlerts?: AthleteDashboardAdministrativeAlert[]
}
