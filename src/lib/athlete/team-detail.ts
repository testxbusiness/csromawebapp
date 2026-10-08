import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { appendSubjectProfile, useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { useAuth } from '@/hooks/useAuth'
import { athleteKeys } from '@/lib/query-keys'
import type { TeamDetailData } from '@/components/shared/TeamDetailModal'

const TEAM_DETAIL_STALE_TIME = 10 * 60 * 1000

export class AthleteTeamDetailQueryError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'AthleteTeamDetailQueryError'
    this.status = status
  }
}

type AthleteTeamDetailQueryInput = {
  accountId: string
  subjectProfileId: string
  subjectProfileQueryParam: string | null
  teamId: string
}

type AthleteTeamDetailQueryOptions = Omit<UseQueryOptions<TeamDetailData, AthleteTeamDetailQueryError>, 'queryKey' | 'queryFn'>

async function fetchTeamDetail(input: AthleteTeamDetailQueryInput, signal: AbortSignal): Promise<TeamDetailData> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new AthleteTeamDetailQueryError('offline')
  const endpoint = appendSubjectProfile(`/api/athlete/teams/detail?id=${encodeURIComponent(input.teamId)}`, input.subjectProfileQueryParam)
  const response = await fetch(endpoint, { cache: 'no-store', signal })
  const payload = await response.json().catch(() => null) as (TeamDetailData & { error?: string }) | null
  if (!response.ok) {
    throw new AthleteTeamDetailQueryError(response.status === 403 ? 'denied' : response.status === 404 ? 'not_found' : payload?.error ?? 'team_detail_fetch_failed', response.status)
  }
  if (!payload) throw new AthleteTeamDetailQueryError('team_detail_fetch_failed', response.status)
  return payload
}

export function athleteTeamDetailQueryOptions(input: AthleteTeamDetailQueryInput, options: AthleteTeamDetailQueryOptions = {}): UseQueryOptions<TeamDetailData, AthleteTeamDetailQueryError> {
  return {
    ...options,
    queryKey: athleteKeys.teamDetail(input.accountId, input.subjectProfileId, input.teamId),
    queryFn: ({ signal }) => fetchTeamDetail(input, signal),
    staleTime: TEAM_DETAIL_STALE_TIME,
    retry: false,
  }
}

export function useAthleteTeamDetailQuery(teamId: string | null) {
  const { account, role, user, loading: authLoading, profileLoading } = useAuth()
  const { activeArea, selectedProfileId } = useAccessibleProfiles()
  const accountId = account?.authUserId ?? user?.id ?? null
  const subjectProfileId = selectedProfileId ?? account?.ownerProfileId ?? null
  const input = accountId && subjectProfileId && teamId
    ? { accountId, subjectProfileId, subjectProfileQueryParam: activeArea === 'family' ? selectedProfileId : null, teamId }
    : null
  const enabled = Boolean(!authLoading && !profileLoading && user && (role === 'athlete' || role === 'family_member') && input && (activeArea !== 'family' || selectedProfileId))
  const queryKey = input ? athleteKeys.teamDetail(input.accountId, input.subjectProfileId, input.teamId) : athleteKeys.teamDetail('anonymous', 'unavailable', teamId ?? 'unavailable')

  return useQuery<TeamDetailData, AthleteTeamDetailQueryError>({
    ...(input
      ? athleteTeamDetailQueryOptions(input)
      : { queryKey, queryFn: async () => { throw new AthleteTeamDetailQueryError('team_detail_context_unavailable') }, staleTime: TEAM_DETAIL_STALE_TIME, retry: false }),
    enabled,
  })
}
