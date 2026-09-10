export type AttendanceStatus = 'going' | 'maybe' | 'declined'

export type AttendanceAction = 'respond' | 'report_early_absence' | 'revoke_early_absence'
export type AttendanceClosureReason = 'not_required' | 'not_next_event' | 'event_started' | 'deadline_passed' | 'not_authorized' | 'already_responded' | 'already_early_absence'

export interface AttendanceActionAvailability {
  respond: boolean
  report_early_absence: boolean
  revoke_early_absence: boolean
}

export interface AttendanceNextEvent {
  id: string
  start_time: string
  end_time: string
  team_ids: string[]
}

/** Additive contract shared by dashboard, calendar and event detail. */
export interface AttendanceAvailabilityContract {
  /** Event configuration, separate from whether this subject can act now. */
  requires_confirmation: boolean
  can_respond_now: boolean
  can_report_early_absence: boolean
  can_revoke_early_absence: boolean
  actions: AttendanceActionAvailability
  closure_reason: AttendanceClosureReason | null
  next_event: AttendanceNextEvent | null
  next_recalculation_at: string | null
}
