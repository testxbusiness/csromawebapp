import { useQuery } from '@tanstack/react-query'
import { appendSubjectProfile, useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { useAuth } from '@/hooks/useAuth'
import { athleteKeys } from '@/lib/query-keys'
import type { AthleteCalendarContract } from '@/types/athlete-calendar'

export const ATHLETE_CALENDAR_STALE_TIME = 2 * 60 * 1000

export class AthleteCalendarQueryError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'AthleteCalendarQueryError'
    this.status = status
  }
}

async function fetchAthleteCalendar(
  subjectProfileId: string | null,
  signal: AbortSignal,
): Promise<AthleteCalendarContract> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new AthleteCalendarQueryError('offline')
  }

  const response = await fetch(appendSubjectProfile('/api/athlete/calendar', subjectProfileId), {
    cache: 'no-store',
    signal,
  })
  const payload = await response.json().catch(() => null) as Partial<AthleteCalendarContract> & { error?: string } | null

  if (!response.ok) {
    throw new AthleteCalendarQueryError(
      response.status === 403 ? 'denied' : payload?.error ?? 'calendar_fetch_failed',
      response.status,
    )
  }

  return {
    events: payload?.events ?? [],
    teams: payload?.teams ?? [],
  }
}

export function useAthleteCalendarQuery() {
  const { account, role, user, loading: authLoading, profileLoading } = useAuth()
  const { activeArea, selectedProfile, selectedProfileId } = useAccessibleProfiles()
  const accountId = account?.authUserId ?? null
  const subjectProfileId = selectedProfileId ?? account?.ownerProfileId ?? null
  const isFamilyView = activeArea === 'family'
  const canViewSchedule = !isFamilyView || selectedProfile?.relationship.permissions.view_schedule === true
  const enabled = Boolean(
    !authLoading && !profileLoading && user && accountId && subjectProfileId &&
    (role === 'athlete' || role === 'family_member') &&
    canViewSchedule && (!isFamilyView || selectedProfileId),
  )
  const queryKey = accountId && subjectProfileId
    ? athleteKeys.calendar(accountId, subjectProfileId)
    : athleteKeys.calendar('anonymous', 'unavailable')

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchAthleteCalendar(isFamilyView ? selectedProfileId : null, signal),
    enabled,
    retry: false,
    staleTime: ATHLETE_CALENDAR_STALE_TIME,
  })

  return { ...query, accountId, subjectProfileId, canViewSchedule, isFamilyView, enabled }
}
