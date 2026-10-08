'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import MessageDetailModal, { type MessageDetailData, type MessageReadState } from '@/components/shared/MessageDetailModal'
import DelegatedAccessDenied from './DelegatedAccessDenied'
import { EmptyState, ErrorState, FeedbackState, LoadingState, OfflineState, Panel } from '@/components/ui'
import { AthleteMessageList, type AthleteMessageListItem } from './AthleteMessageList'
import { filterAthleteMessages, type MessageReadFilter } from '@/lib/athlete/message-filters'
import { AthleteMessagesQueryError, useAthleteMessageDetailQuery, useAthleteMessagesQuery } from '@/lib/athlete/messages'
import { syncAthleteMessageReadCaches } from '@/lib/athlete/cache-synchronization'
import { SUBJECT_CONTEXT_CHANGED_EVENT, useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { useAuth } from '@/hooks/useAuth'
import { useTeamContext } from '@/context/TeamContext'
import type { AthleteMessageContract } from '@/types/athlete-messages'

function toDetailData(message: AthleteMessageContract | AthleteMessageListItem | null): MessageDetailData | null {
  if (!message) return null
  return {
    subject: message.subject,
    content: message.content,
    created_at: message.created_at,
    created_by_profile: message.created_by_profile
      ? {
          first_name: message.created_by_profile.first_name ?? '',
          last_name: message.created_by_profile.last_name ?? '',
          role: message.created_by_profile.role ?? null,
        }
      : null,
    message_recipients: message.message_recipients?.map((recipient, index) => ({
      id: ('id' in recipient ? recipient.id : undefined) ?? `recipient-${index}`,
      teams: recipient.teams ?? null,
      profiles: 'profiles' in recipient ? recipient.profiles ?? null : null,
    })) ?? [],
    attachments: message.attachments ?? [],
  }
}

export default function AthleteMessagesManager() {
  const { profiles, selectedProfileId, selectedProfile, activeArea, setActiveArea, setSelectedProfileId } = useAccessibleProfiles()
  const { account, role, user, loading: authLoading, profileLoading } = useAuth()
  const { teams, selectedTeamId, setTeams, setSelectedTeamId } = useTeamContext()
  const searchParams = useSearchParams()
  const deepLinkMessageId = searchParams.get('messageId')
  const deepLinkSubjectProfileId = searchParams.get('subjectProfileId')
  const queryClient = useQueryClient()
  const messagesQuery = useAthleteMessagesQuery()
  const [selectedMessage, setSelectedMessage] = useState<AthleteMessageListItem | null>(null)
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [readFilter, setReadFilter] = useState<MessageReadFilter>('all')
  const [deepLinkUnavailable, setDeepLinkUnavailable] = useState(false)
  const detailQuery = useAthleteMessageDetailQuery(selectedMessageId)

  const messages = useMemo(() => messagesQuery.data?.messages ?? [], [messagesQuery.data?.messages])
  const listTeams = useMemo(() => messagesQuery.data?.teams ?? [], [messagesQuery.data?.teams])
  const queryError = messagesQuery.error instanceof AthleteMessagesQueryError ? messagesQuery.error : null
  const accessDenied = queryError?.status === 403 || (activeArea === 'family' && selectedProfile?.relationship.permissions.receive_messages === false)
  const offline = queryError?.message === 'offline' || (typeof navigator !== 'undefined' && !navigator.onLine && !messagesQuery.data)
  const hasValidAuthContext = Boolean(user && role)
  const initialLoading = authLoading || profileLoading || (messagesQuery.isPending && !messagesQuery.data && hasValidAuthContext && !accessDenied)
  const loadError = !accessDenied && !offline && Boolean(messagesQuery.error)
  const errorDescription = queryError?.status === 401
    ? 'La sessione non è più disponibile. Ricarica la pagina e riprova.'
    : 'I messaggi non sono disponibili al momento. Riprova tra poco.'
  const selectedDetail = detailQuery.data?.messages?.[0] ?? selectedMessage
  const unreadCount = messages.filter((message) => !message.is_read).length
  const visibleMessages = useMemo(() => filterAthleteMessages(messages, readFilter, selectedTeamId), [messages, readFilter, selectedTeamId])

  useEffect(() => {
    if (listTeams.length > 0 || messagesQuery.data) setTeams(listTeams)
  }, [listTeams, messagesQuery.data, setTeams])

  useEffect(() => {
    const handleSubjectChange = () => {
      setSelectedMessage(null)
      setSelectedMessageId(null)
      setDeepLinkUnavailable(false)
    }
    window.addEventListener(SUBJECT_CONTEXT_CHANGED_EVENT, handleSubjectChange)
    return () => window.removeEventListener(SUBJECT_CONTEXT_CHANGED_EVENT, handleSubjectChange)
  }, [])

  useEffect(() => {
    if (!deepLinkSubjectProfileId || !profiles.some((profile) => profile.profile.id === deepLinkSubjectProfileId)) return
    if (role === 'family_member' || activeArea === 'family') {
      setActiveArea('family')
      setSelectedProfileId(deepLinkSubjectProfileId)
    }
  }, [activeArea, deepLinkSubjectProfileId, profiles, role, setActiveArea, setSelectedProfileId])

  useEffect(() => {
    if (!deepLinkMessageId || selectedMessageId) return
    const linkedMessage = messages.find((message) => message.id === deepLinkMessageId)
    if (linkedMessage) {
      setSelectedMessage(linkedMessage)
      setSelectedMessageId(linkedMessage.id)
    } else if (messagesQuery.isSuccess) {
      setSelectedMessageId(deepLinkMessageId)
    }
  }, [deepLinkMessageId, messages, messagesQuery.isSuccess, selectedMessageId])

  useEffect(() => {
    if (!deepLinkMessageId || selectedMessageId !== deepLinkMessageId || !detailQuery.isError) return
    if (!selectedMessage && detailQuery.error instanceof AthleteMessagesQueryError && detailQuery.error.status === 404) {
      setDeepLinkUnavailable(true)
    }
  }, [deepLinkMessageId, detailQuery.error, detailQuery.isError, selectedMessage, selectedMessageId])

  const handleOpenMessage = useCallback((message: AthleteMessageListItem) => {
    setDeepLinkUnavailable(false)
    setSelectedMessage(message)
    setSelectedMessageId(message.id)
  }, [])

  const handleReadStateChange = useCallback((state: MessageReadState) => {
    if (!selectedMessageId || !account?.authUserId) return
    syncAthleteMessageReadCaches(
      queryClient,
      account.authUserId,
      selectedProfileId ?? account.ownerProfileId,
      { messageId: selectedMessageId, isRead: state.is_read, readAt: state.read_at },
    )
    setSelectedMessage((current) => current ? { ...current, is_read: state.is_read, read_state: state } : current)
  }, [account?.authUserId, account?.ownerProfileId, queryClient, selectedMessageId, selectedProfileId])

  if (!hasValidAuthContext && !authLoading && !profileLoading) return null
  if (initialLoading && !messagesQuery.data) return <LoadingState label="Caricamento messaggi..." />
  if (accessDenied) return <DelegatedAccessDenied section="i messaggi" profileName={selectedProfile ? `${selectedProfile.profile.first_name} ${selectedProfile.profile.last_name}` : undefined} />

  return (
    <div className="cs-athlete-messages space-y-6">
      <div className="cs-athlete-messages__heading"><div><h2 className="text-2xl font-bold tracking-tight">Messaggi</h2><p className="mt-1 text-sm text-secondary">Le comunicazioni della società e delle tue squadre</p></div><span className="cs-athlete-messages__count" aria-live="polite"><span className="font-semibold">{unreadCount}</span> {unreadCount === 1 ? 'non letto' : 'non letti'}</span></div>
      <div className="cs-athlete-messages__filters" aria-label="Filtri messaggi">
        <div className="cs-athlete-messages__tabs" role="group" aria-label="Filtro lettura"><button type="button" className={readFilter === 'all' ? 'is-selected' : ''} aria-pressed={readFilter === 'all'} onClick={() => setReadFilter('all')}>Tutti <span>({messages.length})</span></button><button type="button" className={readFilter === 'unread' ? 'is-selected' : ''} aria-pressed={readFilter === 'unread'} onClick={() => setReadFilter('unread')}>Non letti <span>({unreadCount})</span></button></div>
        {(teams.length > 1 || listTeams.length > 1) ? <div className="cs-athlete-messages__team-filter"><label htmlFor="athlete-messages-team">Squadra</label><select id="athlete-messages-team" className="cs-select" value={selectedTeamId ?? ''} onChange={(event) => setSelectedTeamId(event.target.value || null)}><option value="">Tutte le squadre</option>{(teams.length > 0 ? teams : listTeams).map((team) => <option key={team.id} value={team.id}>{team.name}{team.code ? ` · ${team.code}` : ''}</option>)}</select></div> : null}
      </div>
      <Panel className="cs-athlete-messages__panel overflow-hidden p-0">
        {offline ? <OfflineState title="Messaggi non disponibili offline" description="I messaggi richiedono una connessione. Quando torni online, riprova." className="rounded-none border-0" /> : null}
        {loadError ? <ErrorState title="Impossibile caricare i messaggi" description={errorDescription} action={<button type="button" className="cs-btn cs-btn--primary" onClick={() => void messagesQuery.refetch()}>Riprova</button>} className="rounded-none border-0" /> : null}
        {deepLinkUnavailable ? <FeedbackState variant="error" title="Messaggio non disponibile" description="Il messaggio non è disponibile o non hai accesso a questa comunicazione." className="border-b border-[var(--cs-border-canonical)] text-left" /> : null}
        {messagesQuery.data && (visibleMessages.length > 0 ? <AthleteMessageList messages={visibleMessages} onOpen={handleOpenMessage} /> : messages.length > 0 ? <EmptyState filtered title="Nessun messaggio corrisponde ai filtri" description="Prova a cambiare il filtro di lettura o la squadra." /> : <EmptyState title="Nessun messaggio" description="Qui troverai i messaggi indirizzati a te o alle tue squadre." />)}
      </Panel>
      {selectedDetail ? <MessageDetailModal open={true} onClose={() => { setSelectedMessage(null); setSelectedMessageId(null) }} messageId={selectedDetail.id} subjectProfileId={selectedProfileId} markAsRead readState={selectedDetail.read_state ?? { is_read: selectedDetail.is_read, read_at: null }} onReadStateChange={handleReadStateChange} data={toDetailData(selectedDetail)} /> : null}
    </div>
  )
}
