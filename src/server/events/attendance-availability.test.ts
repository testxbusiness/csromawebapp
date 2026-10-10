import {
  buildAttendanceAvailability,
  resolveAttendanceAvailability,
  type AttendanceResolverEvent,
} from './attendance-availability'

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
      actions: { respond: false, report_early_absence: true, revoke_early_absence: true },
      closure_reason: 'already_early_absence',
    }))
  })

  it('allows early absence for a later future RSVP event without opening full RSVP', () => {
    const now = new Date('2026-09-10T10:00:00.000Z')
    const result = buildAttendanceAvailability(
      [
        { ...event({ id: 'next' }), start_time: '2026-09-11T18:00:00.000Z' },
        { ...event({ id: 'later' }), start_time: '2026-09-14T18:00:00.000Z' },
      ],
      new Map(),
      { view_schedule: true, confirm_attendance: true },
      now,
    )

    expect(result.availabilityByEventId.get('later')).toEqual(expect.objectContaining({
      can_respond_now: false,
      can_report_early_absence: true,
      actions: { respond: false, report_early_absence: true, revoke_early_absence: false },
      closure_reason: 'not_next_event',
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

  it('allows only absence reporting for future training and match events in absence-only mode', () => {
    const training = event({ id: 'training', attendance_mode: 'absence_only', generated_from_schedule_id: 'schedule-1' })
    const match = event({ id: 'match', attendance_mode: 'absence_only', generated_from_schedule_id: null, event_kind: 'match' })
    const result = buildAttendanceAvailability([training, match], new Map(), { view_schedule: true, confirm_attendance: true }, now)

    expect(result.nextEvent).toBeNull()
    expect(result.availabilityByEventId.get('training')).toEqual(expect.objectContaining({
      attendance_mode: 'absence_only',
      actions: { respond: false, report_early_absence: true, revoke_early_absence: false },
    }))
    expect(result.availabilityByEventId.get('match')).toEqual(expect.objectContaining({
      attendance_mode: 'absence_only',
      can_respond_now: false,
      can_report_early_absence: true,
    }))
  })

  it('keeps a migrated self-decline visible as an absence and allows its revocation', () => {
    const converted = event({ id: 'converted', attendance_mode: 'absence_only' })
    const result = buildAttendanceAvailability([converted], new Map([[
      'converted', { event_id: 'converted', status: 'declined', responded_at: now.toISOString(), is_early_absence: false, response_source: 'self' },
    ]]), { view_schedule: true, confirm_attendance: true }, now)
    expect(result.availabilityByEventId.get('converted')).toEqual(expect.objectContaining({
      can_report_early_absence: false,
      can_revoke_early_absence: true,
      closure_reason: 'already_early_absence',
    }))
  })

  it('reuses request-local calendar rows without issuing duplicate availability queries', async () => {
    const client = { from: jest.fn() }
    const calendarEvent = event({ id: 'calendar-event' })

    const result = await resolveAttendanceAvailability(
      client as never,
      'athlete-1',
      { view_schedule: true, confirm_attendance: true },
      [calendarEvent.id],
      now,
      ['team-u14'],
      {
        authorizedTeamIds: ['team-u14'],
        events: [calendarEvent],
        attendanceByEventId: new Map(),
      },
    )

    expect(client.from).not.toHaveBeenCalled()
    expect(result.availabilityByEventId.get(calendarEvent.id)).toEqual(expect.objectContaining({
      can_respond_now: true,
    }))
  })

  it('reuses Event Detail rows while preserving the cross-team next-event rule', async () => {
    const knownEvent = event({ id: 'known-event', start_time: '2026-09-15T18:00:00.000Z' })
    const earlierEvent = event({ id: 'earlier-event', start_time: '2026-09-12T18:00:00.000Z', team_ids: ['team-u16'] })
    const client = {
      from: jest.fn((table: string) => {
        if (table === 'event_teams') return queryBuilder({ data: [{ event_id: earlierEvent.id, team_id: 'team-u16' }] })
        if (table === 'events') return queryBuilder({ data: [{ ...earlierEvent, team_ids: undefined }] })
        return queryBuilder({ data: [] })
      }),
    }
    const attendance = {
      event_id: knownEvent.id,
      status: 'going' as const,
      responded_at: now.toISOString(),
      is_early_absence: false,
    }

    const result = await resolveAttendanceAvailability(
      client as never,
      'athlete-1',
      { view_schedule: true, confirm_attendance: true },
      [knownEvent.id],
      now,
      ['team-u14'],
      undefined,
      ['team-u14'],
      { authorizedTeamIds: ['team-u14', 'team-u16'], knownEvent, knownAttendance: attendance },
    )

    expect(result.nextEvent?.id).toBe(earlierEvent.id)
    expect(result.availabilityByEventId.get(knownEvent.id)?.closure_reason).toBe('already_responded')
    expect(client.from).toHaveBeenCalledTimes(2)
    expect(client.from).not.toHaveBeenCalledWith('event_attendances')
  })
})

function queryBuilder<T>(result: { data: T; error?: null }) {
  type QueryBuilder = {
    select: () => QueryBuilder
    eq: () => QueryBuilder
    in: () => QueryBuilder
    maybeSingle: () => Promise<typeof result>
    then: (resolve: (value: typeof result) => unknown) => Promise<unknown>
  }
  const builder = {} as QueryBuilder
  builder.select = jest.fn(() => builder)
  builder.eq = jest.fn(() => builder)
  builder.in = jest.fn(() => builder)
  builder.maybeSingle = jest.fn(() => Promise.resolve(result))
  builder.then = (resolve) => Promise.resolve(result).then(resolve)
  return builder
}
