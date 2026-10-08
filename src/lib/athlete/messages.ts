import { useQuery } from '@tanstack/react-query'
import { appendSubjectProfile, useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { useAuth } from '@/hooks/useAuth'
import { athleteKeys } from '@/lib/query-keys'
import type { AthleteMessageContract, AthleteMessageTeam } from '@/types/athlete-messages'
import { markAthleteQueryParsed, markAthleteQueryResponse, markAthleteQueryStart } from '@/lib/performance/athlete-first-load'

const ATHLETE_MESSAGES_LIST_STALE_TIME = 45 * 1000
const ATHLETE_MESSAGE_DETAIL_STALE_TIME = 3 * 60 * 1000

export type AthleteMessagesResponse = {
  messages: AthleteMessageContract[]
  teams: AthleteMessageTeam[]
  read_state_scope?: 'account_subject'
}

export class AthleteMessagesQueryError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'AthleteMessagesQueryError'
    this.status = status
  }
}

async function fetchAthleteMessages(
  subjectProfileId: string | null,
  view: 'minimal' | 'full',
  signal: AbortSignal,
  messageId?: string,
): Promise<AthleteMessagesResponse> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new AthleteMessagesQueryError('offline')
  }

  const params = view === 'full' && messageId
    ? `view=full&id=${encodeURIComponent(messageId)}`
    : 'view=minimal'
  const query = view === 'full' ? 'message-detail' : 'messages-list'
  const requestStartedAt = markAthleteQueryStart('messages', query)
  const response = await fetch(appendSubjectProfile(`/api/athlete/messages?${params}`, subjectProfileId), {
    cache: 'no-store',
    signal,
  })
  markAthleteQueryResponse('messages', query, requestStartedAt, response)
  const payload = await response.json().catch(() => null) as Partial<AthleteMessagesResponse> & { error?: string } | null
  markAthleteQueryParsed('messages', query, requestStartedAt)

  if (!response.ok) {
    throw new AthleteMessagesQueryError(
      response.status === 403 ? 'denied' : response.status === 401 ? 'session_expired' : payload?.error ?? 'messages_fetch_failed',
      response.status,
    )
  }

  return {
    messages: payload?.messages ?? [],
    teams: payload?.teams ?? [],
    read_state_scope: payload?.read_state_scope,
  }
}

function useAthleteMessagesContext() {
  const { account, role, user, loading: authLoading, profileLoading } = useAuth()
  const { activeArea, selectedProfile, selectedProfileId } = useAccessibleProfiles()
  const accountId = account?.authUserId ?? null
  const subjectProfileId = selectedProfileId ?? account?.ownerProfileId ?? null
  const isFamilyView = activeArea === 'family'
  const canReadMessages = !isFamilyView || selectedProfile?.relationship.permissions.receive_messages === true
  const enabled = Boolean(
    !authLoading && !profileLoading && user && accountId && subjectProfileId &&
    (role === 'athlete' || role === 'family_member') &&
    canReadMessages && (!isFamilyView || selectedProfileId),
  )

  return { accountId, subjectProfileId, enabled, isFamilyView }
}

export function useAthleteMessagesQuery() {
  const { accountId, subjectProfileId, enabled, isFamilyView } = useAthleteMessagesContext()
  const queryKey = accountId && subjectProfileId
    ? athleteKeys.messages.list(accountId, subjectProfileId)
    : athleteKeys.messages.list('anonymous', 'unavailable')

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchAthleteMessages(isFamilyView ? subjectProfileId : null, 'minimal', signal),
    enabled,
    retry: false,
    staleTime: ATHLETE_MESSAGES_LIST_STALE_TIME,
  })
  return { ...query, enabled }
}

export function useAthleteMessageDetailQuery(messageId: string | null) {
  const { accountId, subjectProfileId, enabled, isFamilyView } = useAthleteMessagesContext()
  const detailEnabled = enabled && Boolean(messageId)
  const queryKey = accountId && subjectProfileId && messageId
    ? athleteKeys.messages.detail(accountId, subjectProfileId, messageId)
    : athleteKeys.messages.detail('anonymous', 'unavailable', messageId ?? 'unavailable')

  return useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchAthleteMessages(isFamilyView ? subjectProfileId : null, 'full', signal, messageId ?? undefined),
    enabled: detailEnabled,
    retry: false,
    staleTime: ATHLETE_MESSAGE_DETAIL_STALE_TIME,
  })
}
