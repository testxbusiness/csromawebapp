import { buildAttendanceAvailability, type AttendanceResolverEvent } from './attendance-availability'

const now = new Date('2026-09-10T10:00:00.000Z')

function event(overrides: Partial<AttendanceResolverEvent> = {}): AttendanceResolverEvent {
  return {
    id: 'event-default',
    start_time: '2026-09-14T18:00:00.000Z',
    end_time: '2026-09-14T20:00:00.000Z',
    title: 'Allenamento',
    requires_confirmation: true,
    generated_from_schedule_id: 'schedule-1',
    team_ids: ['team-u14'],
    ...overrides,
  }
}

describe('attendance availability resolver', () => {
  it('chooses the earliest automatic RSVP event across teams with a stable id tie-breaker', () => {
    const monday = event({ id: 'u14-monday', start_time: '2026-09-14T18:00:00.000Z', team_ids: ['team-u14'] })
    const tuesday = event({ id: 'u16-tuesday', start_time: '2026-09-15T18:00:00.000Z', team_ids: ['team-u16'] })
    const tieB = event({ id: 'z-tie', start_time: '2026-09-12T18:00:00.000Z', team_ids: ['team-u16'] })
    const tieA = event({ id: 'a-tie', start_time: '2026-09-12T18:00:00.000Z', team_ids: ['team-u14'] })

    const result = buildAttendanceAvailability(
      [tuesday, monday, tieB, tieA],
      new Map(),
      { view_schedule: true, confirm_attendance: true },
      now,
    )

    expect(result.nextEvent?.id).toBe('a-tie')
    expect(result.availabilityByEventId.get('u14-monday')?.closure_reason).toBe('not_next_event')
    expect(result.availabilityByEventId.get('u16-tuesday')?.closure_reason).toBe('not_next_event')
  })

  it('does not skip the next event because it was answered or its deadline passed', () => {
    const next = event({ id: 'next', confirmation_deadline: '2026-09-09T10:00:00.000Z' })
    const later = event({ id: 'later', start_time: '2026-09-15T18:00:00.000Z', end_time: '2026-09-15T20:00:00.000Z' })
    const answered = new Map([
      ['next', { event_id: 'next', status: 'declined' as const, responded_at: now.toISOString(), is_early_absence: false }],
    ])

    const result = buildAttendanceAvailability(
      [later, next],
      answered,
      { view_schedule: true, confirm_attendance: true },
      now,
    )

    expect(result.nextEvent?.id).toBe('next')
    expect(result.availabilityByEventId.get('next')?.closure_reason).toBe('already_responded')
    expect(result.availabilityByEventId.get('later')?.closure_reason).toBe('not_next_event')
  })

  it('allows revocation only for a real early absence and only before the deadline', () => {
    const next = event({ id: 'next', confirmation_deadline: '2026-09-11T10:00:00.000Z' })
    const response = new Map([
      ['next', { event_id: 'next', status: 'declined' as const, responded_at: now.toISOString(), is_early_absence: true }],
    ])

    const result = buildAttendanceAvailability(
      [next],
      response,
      { view_schedule: true, confirm_attendance: true },
      now,
    )

    expect(result.availabilityByEventId.get('next')).toEqual(expect.objectContaining({
      can_revoke_early_absence: true,
      actions: { respond: false, report_early_absence: false, revoke_early_absence: true },
      closure_reason: 'already_early_absence',
    }))
  })

  it('keeps family schedule visibility separate from the ability to act', () => {
    const next = event({ id: 'next' })
    const result = buildAttendanceAvailability(
      [next],
      new Map(),
      { view_schedule: true, confirm_attendance: false },
      now,
    )

    expect(result.nextEvent?.id).toBe('next')
    expect(result.availabilityByEventId.get('next')).toEqual(expect.objectContaining({
      can_respond_now: false,
      can_report_early_absence: false,
      closure_reason: 'not_authorized',
    }))
  })

  it('does not apply the one-next-event rule to manual events', () => {
    const manual = event({ id: 'manual', generated_from_schedule_id: null, requires_confirmation: true })
    const result = buildAttendanceAvailability(
      [manual],
      new Map(),
      { view_schedule: true, confirm_attendance: true },
      now,
    )

    expect(result.nextEvent).toBeNull()
    expect(result.availabilityByEventId.has('manual')).toBe(false)
  })
})
