export interface AthleteCalendarTeam {
  id: string
  name: string
  code: string
}

export interface AthleteCalendarAttendance {
  status: AttendanceStatus
  responded_at: string | null
}

export interface AthleteCalendarEvent {
  id: string
  title: string
  description: string | null
  location: string | null
  start_time: string
  end_time: string
  is_recurring: boolean
  /** Legacy display field retained for existing calendar consumers. */
  teams: string[]
  /** Authorized team context for filtering and detail views. */
  team_details: AthleteCalendarTeam[]
  team_ids: string[]
  event_kind: string | null
  requires_confirmation: boolean
  confirmation_deadline: string | null
  my_attendance: AthleteCalendarAttendance | null
  /** Derived presentation flag; it never removes or prioritizes an event. */
  has_conflict?: boolean
}

export interface AthleteCalendarContract {
  events: AthleteCalendarEvent[]
  teams: AthleteCalendarTeam[]
}
import type { AttendanceStatus } from '@/types/attendance'
