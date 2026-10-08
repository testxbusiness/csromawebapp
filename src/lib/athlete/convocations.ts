import { useQuery, type QueryClient, type UseQueryOptions } from '@tanstack/react-query'
import { appendSubjectProfile, useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { useAuth } from '@/hooks/useAuth'
import { athleteKeys } from '@/lib/query-keys'
import type { Convocation } from '@/components/championship/types'

const ATHLETE_CONVOCATION_STALE_TIME = 60 * 1000

export class AthleteConvocationQueryError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'AthleteConvocationQueryError'
    this.status = status
  }
}

type AthleteConvocationQueryInput = {
  accountId: string
  subjectProfileId: string
  subjectProfileQueryParam: string | null
  matchId: string
  clubTeamId: string
}

type AthleteConvocationQueryOptions = Omit<UseQueryOptions<Convocation | null, AthleteConvocationQueryError>, 'queryKey' | 'queryFn'>

function firstRelationUnknown<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined
}

function normalizeConvocation(value: unknown): Convocation | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const members = Array.isArray(raw.championship_match_convocation_members)
    ? raw.championship_match_convocation_members.map((member) => {
        if (!member || typeof member !== 'object') return member
        const rawMember = member as Record<string, unknown>
        return {
          ...rawMember,
          profiles: firstRelationUnknown(rawMember.profiles as { first_name?: string | null; last_name?: string | null } | { first_name?: string | null; last_name?: string | null }[] | null),
          team_members: firstRelationUnknown(rawMember.team_members as { profile_id?: string | null; jersey_number?: number | null; profiles?: { first_name?: string | null; last_name?: string | null } | null } | { profile_id?: string | null; jersey_number?: number | null; profiles?: { first_name?: string | null; last_name?: string | null } | null }[] | null),
        }
      })
    : []

  return {
    ...(raw as unknown as Convocation),
    championship_club_teams: firstRelationUnknown(raw.championship_club_teams as Convocation['championship_club_teams'] | Convocation['championship_club_teams'][]),
    championship_match_convocation_members: members as Convocation['championship_match_convocation_members'],
  }
}

async function fetchAthleteConvocation(input: AthleteConvocationQueryInput, signal: AbortSignal): Promise<Convocation | null> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new AthleteConvocationQueryError('offline')
  }

  const params = new URLSearchParams({
    view: 'convocation',
    matchId: input.matchId,
    clubTeamId: input.clubTeamId,
  })
  const response = await fetch(
    appendSubjectProfile(`/api/athlete/championships?${params.toString()}`, input.subjectProfileQueryParam),
    { cache: 'no-store', signal },
  )
  const payload = await response.json().catch(() => null) as { convocation?: unknown; error?: string } | null

  if (!response.ok) {
    throw new AthleteConvocationQueryError(
      response.status === 403 ? 'denied' : response.status === 404 ? 'not_found' : payload?.error ?? 'convocation_fetch_failed',
      response.status,
    )
  }

  return normalizeConvocation(payload?.convocation)
}

export function athleteConvocationQueryOptions(
  input: AthleteConvocationQueryInput,
  options: AthleteConvocationQueryOptions = {},
): UseQueryOptions<Convocation | null, AthleteConvocationQueryError> {
  return {
    ...options,
    queryKey: athleteKeys.championships.convocation(input.accountId, input.subjectProfileId, input.matchId, input.clubTeamId),
    queryFn: ({ signal }) => fetchAthleteConvocation(input, signal),
    staleTime: ATHLETE_CONVOCATION_STALE_TIME,
    retry: false,
  }
}

export async function prefetchAthleteConvocation(
  queryClient: QueryClient,
  input: AthleteConvocationQueryInput,
): Promise<void> {
  await queryClient.prefetchQuery(athleteConvocationQueryOptions(input))
}

export function useAthleteConvocationQuery(
  matchId: string | null,
  clubTeamId: string | null,
  enabled: boolean,
) {
  const { account, role, user, loading: authLoading, profileLoading } = useAuth()
  const { activeArea, selectedProfileId } = useAccessibleProfiles()
  const accountId = account?.authUserId ?? user?.id ?? null
  const subjectProfileId = selectedProfileId ?? account?.ownerProfileId ?? null
  const subjectProfileQueryParam = activeArea === 'family' ? selectedProfileId : null
  const input = accountId && subjectProfileId && matchId && clubTeamId
    ? { accountId, subjectProfileId, subjectProfileQueryParam, matchId, clubTeamId }
    : null
  const queryEnabled = Boolean(
    enabled && !authLoading && !profileLoading && user &&
    (role === 'athlete' || role === 'family_member') &&
    input && (activeArea !== 'family' || selectedProfileId),
  )
  const queryKey = input
    ? athleteKeys.championships.convocation(input.accountId, input.subjectProfileId, input.matchId, input.clubTeamId)
    : athleteKeys.championships.convocation('anonymous', 'unavailable', matchId ?? 'unavailable', clubTeamId ?? 'unavailable')

  const options = input
    ? athleteConvocationQueryOptions(input)
    : {
        queryKey,
        queryFn: async () => null,
        staleTime: ATHLETE_CONVOCATION_STALE_TIME,
        retry: false,
      }

  return useQuery({ ...options, enabled: queryEnabled })
}

export function useAthleteConvocationContext() {
  const { account, user } = useAuth()
  const { activeArea, selectedProfileId } = useAccessibleProfiles()
  const accountId = account?.authUserId ?? user?.id ?? null
  const subjectProfileId = selectedProfileId ?? account?.ownerProfileId ?? null
  return {
    accountId,
    subjectProfileId,
    subjectProfileQueryParam: activeArea === 'family' ? selectedProfileId : null,
  }
}
