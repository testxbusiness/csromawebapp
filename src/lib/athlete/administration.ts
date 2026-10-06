import { useQuery } from '@tanstack/react-query'
import { appendSubjectProfile, useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { useAuth } from '@/hooks/useAuth'
import { athleteKeys } from '@/lib/query-keys'
import type { AthleteAdministrationContract } from '@/types/athlete-administration'

const ATHLETE_ADMINISTRATION_STALE_TIME = 3 * 60 * 1000

export class AthleteAdministrationQueryError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'AthleteAdministrationQueryError'
    this.status = status
  }
}

async function fetchAthleteAdministration(subjectProfileId: string | null): Promise<AthleteAdministrationContract> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new AthleteAdministrationQueryError('offline')
  const response = await fetch(appendSubjectProfile('/api/athlete/administration', subjectProfileId), { cache: 'no-store' })
  if (!response.ok) throw new AthleteAdministrationQueryError(response.status === 403 ? 'denied' : 'administration_fetch_failed', response.status)
  return await response.json() as AthleteAdministrationContract
}

export function useAthleteAdministrationQuery() {
  const { account, role, user, loading: authLoading, profileLoading } = useAuth()
  const { activeArea, selectedProfileId } = useAccessibleProfiles()
  const accountId = account?.authUserId ?? null
  const subjectProfileId = selectedProfileId ?? account?.ownerProfileId ?? null
  const isFamilyView = activeArea === 'family'
  const enabled = Boolean(!authLoading && !profileLoading && user && accountId && subjectProfileId && (role === 'athlete' || role === 'family_member') && (!isFamilyView || selectedProfileId))
  const queryKey = accountId && subjectProfileId ? athleteKeys.administration(accountId, subjectProfileId) : athleteKeys.administration('anonymous', 'unavailable')
  return useQuery({
    queryKey,
    queryFn: () => fetchAthleteAdministration(isFamilyView ? selectedProfileId : null),
    enabled,
    retry: false,
    staleTime: ATHLETE_ADMINISTRATION_STALE_TIME,
  })
}
