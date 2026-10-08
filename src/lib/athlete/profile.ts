import { useQuery } from '@tanstack/react-query'
import { appendSubjectProfile, useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { useAuth } from '@/hooks/useAuth'
import { athleteKeys } from '@/lib/query-keys'
import type { AthleteProfileContract } from '@/types/athlete-profile'
import { markAthleteQueryParsed, markAthleteQueryResponse, markAthleteQueryStart } from '@/lib/performance/athlete-first-load'

const ATHLETE_PROFILE_STALE_TIME = 5 * 60 * 1000

export class AthleteProfileQueryError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'AthleteProfileQueryError'
    this.status = status
  }
}

async function fetchAthleteProfile(subjectProfileId: string | null): Promise<AthleteProfileContract> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new AthleteProfileQueryError('offline')
  }

  const requestStartedAt = markAthleteQueryStart('profile', 'profile')
  const response = await fetch(
    appendSubjectProfile('/api/athlete/profile', subjectProfileId),
    { cache: 'no-store' },
  )
  markAthleteQueryResponse('profile', 'profile', requestStartedAt, response)

  if (!response.ok) {
    throw new AthleteProfileQueryError(
      response.status === 403 ? 'denied' : 'profile_fetch_failed',
      response.status,
    )
  }

  const payload = await response.json() as AthleteProfileContract
  markAthleteQueryParsed('profile', 'profile', requestStartedAt)
  return payload as AthleteProfileContract
}

export function useAthleteProfileQuery() {
  const { account, role, user, loading: authLoading, profileLoading } = useAuth()
  const { activeArea, selectedProfileId } = useAccessibleProfiles()
  const accountId = account?.authUserId ?? null
  const subjectProfileId = selectedProfileId ?? account?.ownerProfileId ?? null
  const isFamilyView = activeArea === 'family'
  const enabled = Boolean(
    !authLoading && !profileLoading && user && accountId && subjectProfileId &&
    (role === 'athlete' || role === 'family_member') &&
    (!isFamilyView || selectedProfileId),
  )
  const queryKey = accountId && subjectProfileId
    ? athleteKeys.profile(accountId, subjectProfileId)
    : athleteKeys.profile('anonymous', 'unavailable')

  const query = useQuery({
    queryKey,
    queryFn: () => fetchAthleteProfile(isFamilyView ? selectedProfileId : null),
    enabled,
    retry: false,
    staleTime: ATHLETE_PROFILE_STALE_TIME,
  })
  return { ...query, enabled }
}
