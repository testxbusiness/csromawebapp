import type { QueryClient } from '@tanstack/react-query'
import { athleteKeys } from '@/lib/query-keys'

type CacheRecord = Record<string, unknown>

export type AthleteAttendanceCachePatch = {
  eventId: string
  myAttendance: CacheRecord | null
  attendanceAvailability?: unknown
}

export type AthleteMessageReadCachePatch = {
  messageId: string
  isRead: boolean
  readAt?: string | null
}

const processedReadTransitions = new WeakMap<QueryClient, Set<string>>()

function isRecord(value: unknown): value is CacheRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function updateEventCollection(events: unknown[], patch: AthleteAttendanceCachePatch): unknown[] {
  return events.map((event) => {
    if (!isRecord(event) || event.id !== patch.eventId) return event
    return {
      ...event,
      my_attendance: patch.myAttendance,
      ...(patch.attendanceAvailability !== undefined
        ? { attendance_availability: patch.attendanceAvailability }
        : {}),
    }
  })
}

/** Updates only already-populated Dashboard and Calendar cache entries. */
export function syncAthleteAttendanceCaches(
  queryClient: QueryClient,
  accountId: string,
  subjectProfileId: string,
  patch: AthleteAttendanceCachePatch,
): void {
  const dashboardKey = athleteKeys.dashboard(accountId, subjectProfileId)
  const dashboard = queryClient.getQueryData<CacheRecord>(dashboardKey)
  if (dashboard && Array.isArray(dashboard.upcomingEvents)) {
    queryClient.setQueryData(dashboardKey, {
      ...dashboard,
      upcomingEvents: updateEventCollection(dashboard.upcomingEvents, patch),
    })
  }

  const calendarKey = athleteKeys.calendar(accountId, subjectProfileId)
  const calendar = queryClient.getQueryData<CacheRecord>(calendarKey)
  if (calendar && Array.isArray(calendar.events)) {
    queryClient.setQueryData(calendarKey, {
      ...calendar,
      events: updateEventCollection(calendar.events, patch),
    })
  }

  const detailKey = athleteKeys.events.detail(accountId, subjectProfileId, patch.eventId)
  const detail = queryClient.getQueryData<CacheRecord>(detailKey)
  if (detail) {
    queryClient.setQueryData(detailKey, {
      ...detail,
      my_attendance: patch.myAttendance,
      ...(patch.attendanceAvailability !== undefined
        ? { attendance_availability: patch.attendanceAvailability }
        : {}),
    })
  }
}

function updateMessage(message: unknown, patch: AthleteMessageReadCachePatch): unknown {
  if (!isRecord(message) || message.id !== patch.messageId) return message
  const existingReadState = isRecord(message.read_state) ? message.read_state : null
  return {
    ...message,
    is_read: patch.isRead,
    read_state: {
      ...(existingReadState ?? {}),
      is_read: patch.isRead,
      ...(patch.readAt !== undefined ? { read_at: patch.readAt } : {}),
    },
  }
}

function getMessageState(queryClient: QueryClient, key: readonly unknown[], collectionKey: 'messages' | 'unreadMessages', messageId: string): boolean | null {
  const data = queryClient.getQueryData<CacheRecord>(key)
  if (!data || !Array.isArray(data[collectionKey])) return null
  const message = data[collectionKey].find((item) => isRecord(item) && item.id === messageId)
  if (!isRecord(message)) return null
  return message.is_read === true
}

/**
 * Synchronizes every existing message representation for one account/subject.
 * The transition marker makes repeated legacy read events idempotent when no
 * list/detail/dashboard cache is mounted to prove the previous state.
 */
export function syncAthleteMessageReadCaches(
  queryClient: QueryClient,
  accountId: string,
  subjectProfileId: string,
  patch: AthleteMessageReadCachePatch,
): void {
  const listKey = athleteKeys.messages.list(accountId, subjectProfileId)
  const detailKey = athleteKeys.messages.detail(accountId, subjectProfileId, patch.messageId)
  const dashboardKey = athleteKeys.dashboard(accountId, subjectProfileId)
  const unreadKey = athleteKeys.messages.unread(accountId, subjectProfileId)

  const previousStates = [
    getMessageState(queryClient, listKey, 'messages', patch.messageId),
    getMessageState(queryClient, detailKey, 'messages', patch.messageId),
    getMessageState(queryClient, dashboardKey, 'unreadMessages', patch.messageId),
  ].filter((state): state is boolean => state !== null)
  const wasUnread = previousStates.some((state) => state === false)
  const hasMessageState = previousStates.length > 0
  const transitionKey = `${accountId}:${subjectProfileId}:${patch.messageId}`
  const transitions = processedReadTransitions.get(queryClient) ?? new Set<string>()
  processedReadTransitions.set(queryClient, transitions)
  const alreadyProcessed = transitions.has(transitionKey)
  const shouldDecrement = patch.isRead && !alreadyProcessed && (wasUnread || !hasMessageState)

  const list = queryClient.getQueryData<CacheRecord>(listKey)
  if (list && Array.isArray(list.messages)) {
    queryClient.setQueryData(listKey, { ...list, messages: list.messages.map((message) => updateMessage(message, patch)) })
  }

  const detail = queryClient.getQueryData<CacheRecord>(detailKey)
  if (detail && Array.isArray(detail.messages)) {
    queryClient.setQueryData(detailKey, { ...detail, messages: detail.messages.map((message) => updateMessage(message, patch)) })
  }

  const dashboard = queryClient.getQueryData<CacheRecord>(dashboardKey)
  if (dashboard) {
    queryClient.setQueryData(dashboardKey, {
      ...dashboard,
      ...(Array.isArray(dashboard.unreadMessages)
        ? { unreadMessages: dashboard.unreadMessages.map((message) => updateMessage(message, patch)) }
        : {}),
      ...(shouldDecrement && typeof dashboard.unreadMessageCount === 'number'
        ? { unreadMessageCount: Math.max(0, dashboard.unreadMessageCount - 1) }
        : {}),
    })
  }

  const unreadCount = queryClient.getQueryData<number>(unreadKey)
  if (typeof unreadCount === 'number') {
    queryClient.setQueryData(unreadKey, shouldDecrement ? Math.max(0, unreadCount - 1) : unreadCount)
  }

  if (patch.isRead) transitions.add(transitionKey)
}
