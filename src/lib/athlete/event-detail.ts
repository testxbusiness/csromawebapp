import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { appendSubjectProfile, useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { useAuth } from '@/hooks/useAuth'
import { athleteKeys } from '@/lib/query-keys'
import type { EventDetailData } from '@/components/shared/EventDetailModal'

export const ATHLETE_EVENT_DETAIL_STALE_TIME = 60 * 1000

export class AthleteEventDetailQueryError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'AthleteEventDetailQueryError'
    this.status = status
  }
}

type AthleteEventDetailQueryInput = {
  accountId: string
  subjectProfileId: string
  subjectProfileQueryParam: string | null
  eventId: string
}

type AthleteEventDetailQueryOptions = Omit<UseQueryOptions<EventDetailData, AthleteEventDetailQueryError>, 'queryKey' | 'queryFn'>

async function fetchAthleteEventDetail(input: AthleteEventDetailQueryInput, signal: AbortSignal): Promise<EventDetailData> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new AthleteEventDetailQueryError('offline')
  }

  const response = await fetch(
    appendSubjectProfile(`/api/athlete/events/detail?id=${encodeURIComponent(input.eventId)}`, input.subjectProfileQueryParam),
    { cache: 'no-store', signal },
  )
  const payload = await response.json().catch(() => null) as EventDetailData & { error?: string } | null

  if (!response.ok) {
    throw new AthleteEventDetailQueryError(
      response.status === 403 ? 'denied' : response.status === 404 ? 'not_found' : payload?.error ?? 'event_detail_fetch_failed',
      response.status,
    )
  }
  if (!payload || typeof payload !== 'object' || payload.error) {
    throw new AthleteEventDetailQueryError('event_detail_fetch_failed')
  }

  return payload
}

export function athleteEventDetailQueryOptions(
  input: AthleteEventDetailQueryInput,
  options: AthleteEventDetailQueryOptions = {},
): UseQueryOptions<EventDetailData, AthleteEventDetailQueryError> {
  return {
    ...options,
    queryKey: athleteKeys.events.detail(input.accountId, input.subjectProfileId, input.eventId),
    queryFn: ({ signal }) => fetchAthleteEventDetail(input, signal),
    staleTime: ATHLETE_EVENT_DETAIL_STALE_TIME,
    retry: false,
  }
}

export function useAthleteEventDetailQuery(eventId: string | null) {
  const { account, role, user, loading: authLoading, profileLoading } = useAuth()
  const { activeArea, selectedProfile, selectedProfileId } = useAccessibleProfiles()
  const accountId = account?.authUserId ?? null
  const subjectProfileId = selectedProfileId ?? account?.ownerProfileId ?? null
  const isFamilyView = activeArea === 'family'
  const canViewSchedule = !isFamilyView || selectedProfile?.relationship.permissions.view_schedule === true
  const input = accountId && subjectProfileId && eventId
    ? { accountId, subjectProfileId, subjectProfileQueryParam: isFamilyView ? selectedProfileId : null, eventId }
    : null
  const enabled = Boolean(
    !authLoading && !profileLoading && user &&
    (role === 'athlete' || role === 'family_member') &&
    canViewSchedule && eventId && input && (!isFamilyView || selectedProfileId),
  )
  const queryKey = input
    ? athleteKeys.events.detail(input.accountId, input.subjectProfileId, input.eventId)
    : athleteKeys.events.detail('anonymous', 'unavailable', eventId ?? 'unavailable')

  const query = useQuery<EventDetailData, AthleteEventDetailQueryError>({
    ...(input
      ? athleteEventDetailQueryOptions(input)
      : { queryKey, queryFn: async () => { throw new AthleteEventDetailQueryError('event_detail_context_unavailable') }, staleTime: ATHLETE_EVENT_DETAIL_STALE_TIME, retry: false }),
    enabled,
  })

  return { ...query, accountId, subjectProfileId, canViewSchedule, isFamilyView, enabled }
}
