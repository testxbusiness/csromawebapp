import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { appendSubjectProfile, useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { useAuth } from '@/hooks/useAuth'
import { athleteKeys } from '@/lib/query-keys'
import { MESSAGE_READ_STATE_CHANGED_EVENT, type MessageReadStateChangedDetail } from '@/lib/messages/read-state-events'
import { syncAthleteMessageReadCaches } from '@/lib/athlete/cache-synchronization'

const UNREAD_COUNT_STALE_TIME = 15_000

type UnreadMessagesResponse = {
  unreadMessageCount?: number
  error?: string
}

async function fetchUnreadMessageCount(subjectProfileId: string | null): Promise<number> {
  const response = await fetch(
    appendSubjectProfile('/api/athlete/messages?countOnly=1', subjectProfileId),
    { cache: 'no-store' },
  )
  const payload = await response.json().catch(() => null) as UnreadMessagesResponse | null
  if (!response.ok) throw new Error(payload && 'error' in payload ? String(payload.error) : 'Impossibile caricare i messaggi non letti')
  return typeof payload?.unreadMessageCount === 'number' ? payload.unreadMessageCount : 0
}

export function useAthleteUnreadMessageCount() {
  const { account, role } = useAuth()
  const { activeArea, selectedProfile, selectedProfileId } = useAccessibleProfiles()
  const queryClient = useQueryClient()
  const isFamilyView = activeArea === 'family'
  const canReadMessages = !isFamilyView || selectedProfile?.relationship.permissions.receive_messages === true
  const subjectProfileId = selectedProfileId ?? account?.ownerProfileId ?? null
  const accountId = account?.authUserId ?? null
  const enabled = Boolean(
    accountId && subjectProfileId &&
    (role === 'athlete' || role === 'family_member') &&
    canReadMessages && (!isFamilyView || selectedProfileId),
  )
  const queryKey = accountId && subjectProfileId
    ? athleteKeys.messages.unread(accountId, subjectProfileId)
    : athleteKeys.messages.unread('anonymous', 'unavailable')

  const query = useQuery({
    queryKey,
    queryFn: () => fetchUnreadMessageCount(isFamilyView ? selectedProfileId : null),
    enabled,
    staleTime: UNREAD_COUNT_STALE_TIME,
  })

  useEffect(() => {
    if (!enabled || !accountId || !subjectProfileId) return

    const handleReadStateChanged = (event: Event) => {
      const detail = (event as CustomEvent<MessageReadStateChangedDetail>).detail
      if ((detail?.subjectProfileId ?? null) !== (isFamilyView ? selectedProfileId : null)) return
      if (detail?.isRead !== true) return
      syncAthleteMessageReadCaches(queryClient, accountId, subjectProfileId, {
        messageId: detail.messageId,
        isRead: detail.isRead === true,
        readAt: detail.readAt,
      })
    }

    window.addEventListener(MESSAGE_READ_STATE_CHANGED_EVENT, handleReadStateChanged)
    return () => window.removeEventListener(MESSAGE_READ_STATE_CHANGED_EVENT, handleReadStateChanged)
  }, [accountId, enabled, isFamilyView, queryClient, selectedProfileId, subjectProfileId])

  return query
}
