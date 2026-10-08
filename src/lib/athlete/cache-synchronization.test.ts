import { QueryClient } from '@tanstack/react-query'
import { athleteKeys } from '@/lib/query-keys'
import { syncAthleteAttendanceCaches, syncAthleteMessageReadCaches } from './cache-synchronization'

const accountId = 'account-1'
const subjectProfileId = 'athlete-1'
const eventId = 'event-1'
const messageId = 'message-1'

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function event(overrides: Record<string, unknown> = {}) {
  return { id: eventId, my_attendance: null, attendance_availability: null, ...overrides }
}

function populateEventCaches(queryClient: QueryClient) {
  queryClient.setQueryData(athleteKeys.dashboard(accountId, subjectProfileId), {
    upcomingEvents: [event()],
    unreadMessages: [],
    unreadMessageCount: 0,
  })
  queryClient.setQueryData(athleteKeys.calendar(accountId, subjectProfileId), {
    events: [event()],
    teams: [],
  })
}

describe('athlete cross-query cache synchronization', () => {
  it.each([
    ['Dashboard', 'Calendar'],
    ['Calendar', 'Dashboard'],
  ])('%s attendance mutation updates the %s cache without refetch', () => {
    const queryClient = createQueryClient()
    populateEventCaches(queryClient)

    syncAthleteAttendanceCaches(queryClient, accountId, subjectProfileId, {
      eventId,
      myAttendance: { status: 'going', responded_at: '2026-10-08T10:00:00.000Z' },
    })

    expect(queryClient.getQueryData<{ events: Array<{ my_attendance: unknown }> }>(athleteKeys.calendar(accountId, subjectProfileId))?.events[0].my_attendance)
      .toEqual({ status: 'going', responded_at: '2026-10-08T10:00:00.000Z' })
    expect(queryClient.getQueryData<{ upcomingEvents: Array<{ my_attendance: unknown }> }>(athleteKeys.dashboard(accountId, subjectProfileId))?.upcomingEvents[0].my_attendance)
      .toEqual({ status: 'going', responded_at: '2026-10-08T10:00:00.000Z' })
  })

  it.each([
    ['Dashboard', 'Calendar'],
    ['Calendar', 'Dashboard'],
  ])('%s early absence mutation updates the %s cache including capability state', () => {
    const queryClient = createQueryClient()
    populateEventCaches(queryClient)
    const availability = { can_respond_now: false, can_report_early_absence: false, can_revoke_early_absence: true }

    syncAthleteAttendanceCaches(queryClient, accountId, subjectProfileId, {
      eventId,
      myAttendance: { status: 'declined', responded_at: '2026-10-08T10:00:00.000Z', is_early_absence: true },
      attendanceAvailability: availability,
    })

    expect(queryClient.getQueryData<{ events: Array<{ my_attendance: unknown; attendance_availability: unknown }> }>(athleteKeys.calendar(accountId, subjectProfileId))?.events[0])
      .toMatchObject({ my_attendance: { is_early_absence: true }, attendance_availability: availability })
    expect(queryClient.getQueryData<{ upcomingEvents: Array<{ my_attendance: unknown; attendance_availability: unknown }> }>(athleteKeys.dashboard(accountId, subjectProfileId))?.upcomingEvents[0])
      .toMatchObject({ my_attendance: { is_early_absence: true }, attendance_availability: availability })
  })

  it('does not invent a Calendar cache when Calendar was not visited', () => {
    const queryClient = createQueryClient()
    queryClient.setQueryData(athleteKeys.dashboard(accountId, subjectProfileId), { upcomingEvents: [event()] })

    syncAthleteAttendanceCaches(queryClient, accountId, subjectProfileId, {
      eventId,
      myAttendance: { status: 'maybe', responded_at: null },
    })

    expect(queryClient.getQueryData(athleteKeys.calendar(accountId, subjectProfileId))).toBeUndefined()
  })

  it('keeps attendance synchronization isolated by subject', () => {
    const queryClient = createQueryClient()
    const otherSubject = 'athlete-2'
    queryClient.setQueryData(athleteKeys.dashboard(accountId, subjectProfileId), { upcomingEvents: [event()] })
    queryClient.setQueryData(athleteKeys.dashboard(accountId, otherSubject), { upcomingEvents: [event({ my_attendance: { status: 'declined' } })] })

    syncAthleteAttendanceCaches(queryClient, accountId, subjectProfileId, {
      eventId,
      myAttendance: { status: 'going', responded_at: null },
    })

    expect(queryClient.getQueryData<{ upcomingEvents: Array<{ my_attendance: unknown }> }>(athleteKeys.dashboard(accountId, otherSubject))?.upcomingEvents[0].my_attendance)
      .toEqual({ status: 'declined' })
  })

  it('synchronizes Messages read state to list, detail, unread and Dashboard', () => {
    const queryClient = createQueryClient()
    const unreadMessage = { id: messageId, is_read: false, read_state: { is_read: false, read_at: null } }
    queryClient.setQueryData(athleteKeys.messages.list(accountId, subjectProfileId), { messages: [unreadMessage], teams: [] })
    queryClient.setQueryData(athleteKeys.messages.detail(accountId, subjectProfileId, messageId), { messages: [unreadMessage], teams: [] })
    queryClient.setQueryData(athleteKeys.messages.unread(accountId, subjectProfileId), 3)
    queryClient.setQueryData(athleteKeys.dashboard(accountId, subjectProfileId), { upcomingEvents: [], unreadMessages: [unreadMessage], unreadMessageCount: 3 })

    syncAthleteMessageReadCaches(queryClient, accountId, subjectProfileId, { messageId, isRead: true, readAt: '2026-10-08T10:01:00.000Z' })

    expect(queryClient.getQueryData<{ messages: Array<{ is_read: boolean }> }>(athleteKeys.messages.list(accountId, subjectProfileId))?.messages[0].is_read).toBe(true)
    expect(queryClient.getQueryData<{ messages: Array<{ read_state: unknown }> }>(athleteKeys.messages.detail(accountId, subjectProfileId, messageId))?.messages[0].read_state).toEqual({ is_read: true, read_at: '2026-10-08T10:01:00.000Z' })
    expect(queryClient.getQueryData(athleteKeys.messages.unread(accountId, subjectProfileId))).toBe(2)
    expect(queryClient.getQueryData<{ unreadMessageCount: number }>(athleteKeys.dashboard(accountId, subjectProfileId))?.unreadMessageCount).toBe(2)
    expect(queryClient.getQueryData<{ unreadMessages: Array<{ is_read: boolean }> }>(athleteKeys.dashboard(accountId, subjectProfileId))?.unreadMessages[0].is_read).toBe(true)
  })

  it('keeps a repeated read notification idempotent', () => {
    const queryClient = createQueryClient()
    queryClient.setQueryData(athleteKeys.messages.unread(accountId, subjectProfileId), 1)

    const patch = { messageId, isRead: true, readAt: null }
    syncAthleteMessageReadCaches(queryClient, accountId, subjectProfileId, patch)
    syncAthleteMessageReadCaches(queryClient, accountId, subjectProfileId, patch)

    expect(queryClient.getQueryData(athleteKeys.messages.unread(accountId, subjectProfileId))).toBe(0)
  })

  it('does not create absent message caches or mutate another subject', () => {
    const queryClient = createQueryClient()
    const otherSubject = 'athlete-2'
    queryClient.setQueryData(athleteKeys.messages.unread(accountId, otherSubject), 4)

    syncAthleteMessageReadCaches(queryClient, accountId, subjectProfileId, { messageId, isRead: true })

    expect(queryClient.getQueryData(athleteKeys.messages.list(accountId, subjectProfileId))).toBeUndefined()
    expect(queryClient.getQueryData(athleteKeys.messages.detail(accountId, subjectProfileId, messageId))).toBeUndefined()
    expect(queryClient.getQueryData(athleteKeys.dashboard(accountId, subjectProfileId))).toBeUndefined()
    expect(queryClient.getQueryData(athleteKeys.messages.unread(accountId, otherSubject))).toBe(4)
  })
})
