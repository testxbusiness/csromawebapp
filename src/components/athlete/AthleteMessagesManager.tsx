'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import MessageDetailModal, { type MessageReadState } from '@/components/shared/MessageDetailModal'
import DelegatedAccessDenied from './DelegatedAccessDenied'
import { EmptyState, ErrorState, FeedbackState, LoadingState, OfflineState, Panel } from '@/components/ui'
import { AthleteMessageList, type AthleteMessageListItem } from './AthleteMessageList'
import { filterAthleteMessages, type MessageReadFilter } from '@/lib/athlete/message-filters'
import { appendSubjectProfile, SUBJECT_CONTEXT_CHANGED_EVENT, type SubjectContextChangedDetail, useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { useAuth } from '@/hooks/useAuth'
import { useTeamContext } from '@/context/TeamContext'

type MessagesLoadState = 'loading' | 'ready' | 'error' | 'offline'

export default function AthleteMessagesManager() {
  const { profiles, selectedProfileId, selectedProfile, activeArea, setActiveArea, setSelectedProfileId } = useAccessibleProfiles()
  const { role, user, loading: authLoading, profileLoading } = useAuth()
  const { teams, selectedTeamId, setTeams, setSelectedTeamId } = useTeamContext()
  const searchParams = useSearchParams()
  const deepLinkMessageId = searchParams.get('messageId')
  const deepLinkSubjectProfileId = searchParams.get('subjectProfileId')
  const [messages, setMessages] = useState<AthleteMessageListItem[]>([])
  const [loadState, setLoadState] = useState<MessagesLoadState>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<AthleteMessageListItem | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const [readFilter, setReadFilter] = useState<MessageReadFilter>('all')
  const [deepLinkUnavailable, setDeepLinkUnavailable] = useState(false)
  const messagesRequestRef = useRef<AbortController | null>(null)
  const messageDetailRequestRef = useRef<AbortController | null>(null)
  const subjectContextRef = useRef<string | null>(null)

  useEffect(() => {
    const handleSubjectChange = (event: Event) => {
      subjectContextRef.current = (event as CustomEvent<SubjectContextChangedDetail>).detail?.subjectProfileId ?? 'self'
      messagesRequestRef.current?.abort()
      messageDetailRequestRef.current?.abort()
      setMessages([])
      setSelectedMessage(null)
      setDeepLinkUnavailable(false)
      setAccessDenied(false)
      setLoadState('loading')
    }
    window.addEventListener(SUBJECT_CONTEXT_CHANGED_EVENT, handleSubjectChange)
    return () => window.removeEventListener(SUBJECT_CONTEXT_CHANGED_EVENT, handleSubjectChange)
  }, [])

  const loadMessages = useCallback(async () => {
    const subjectContext = selectedProfileId ?? 'self'
    if (subjectContextRef.current !== subjectContext) {
      subjectContextRef.current = subjectContext
      setMessages([])
      setSelectedMessage(null)
      setDeepLinkUnavailable(false)
    }

    if (!user?.id || !role) {
      messagesRequestRef.current?.abort()
      setLoadState('ready')
      return
    }

    if (authLoading || profileLoading) {
      setLoadState('loading')
      return
    }
    if (activeArea === 'family' && (!selectedProfile || !selectedProfile.relationship.permissions.receive_messages)) {
      setAccessDenied(true)
      setMessages([])
      setLoadState('ready')
      return
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setLoadError(null)
      setLoadState('offline')
      return
    }
    setLoadState('loading')
    setLoadError(null)
    setAccessDenied(false)
    messagesRequestRef.current?.abort()
    const controller = new AbortController()
    messagesRequestRef.current = controller
    try {
      const res = await fetch(appendSubjectProfile('/api/athlete/messages?view=minimal', selectedProfileId), {
        signal: controller.signal,
      })
      const result = await res.json()
      if (controller.signal.aborted || subjectContextRef.current !== subjectContext) return
      if (!res.ok) {
        if (res.status === 403) {
          setAccessDenied(true)
          setMessages([])
          setLoadState('ready')
          return
        }
        if (res.status === 401) {
          setLoadError('La sessione non è più disponibile. Ricarica la pagina e riprova.')
          setLoadState('error')
          return
        }
        throw new Error(result?.error || 'Errore caricamento messaggi')
      }
      setTeams((result.teams || []).map((team: { id: string; name: string; code?: string | null }) => team))
      setMessages(result.messages || [])
      setLoadState('ready')
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      console.error('Errore caricamento messaggi atleta:', e)
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setLoadError(null)
        setLoadState('offline')
      } else {
        setLoadError('I messaggi non sono disponibili al momento. Riprova tra poco.')
        setLoadState('error')
      }
    } finally {
      if (controller.signal.aborted) return
    }
  }, [activeArea, authLoading, profileLoading, role, selectedProfile, selectedProfileId, setTeams, user?.id])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  const loadMessageDetail = useCallback(async (messageId: string, fallbackMessage?: AthleteMessageListItem) => {
    const subjectContext = selectedProfileId ?? 'self'
    messageDetailRequestRef.current?.abort()
    const controller = new AbortController()
    messageDetailRequestRef.current = controller
    setDeepLinkUnavailable(false)
    if (fallbackMessage) setSelectedMessage(fallbackMessage)

    try {
      const res = await fetch(
        appendSubjectProfile(`/api/athlete/messages?view=full&id=${encodeURIComponent(messageId)}`, selectedProfileId),
        { signal: controller.signal },
      )
      const result = await res.json() as { messages?: AthleteMessageListItem[] }
      if (controller.signal.aborted || subjectContextRef.current !== subjectContext) return
      if (!res.ok || !result.messages?.length) {
        if (!fallbackMessage && res.status === 404) setDeepLinkUnavailable(true)
        return
      }
      setSelectedMessage((current) => current?.id === messageId || !current ? result.messages![0] : current)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (!fallbackMessage && subjectContextRef.current === subjectContext) setDeepLinkUnavailable(true)
    }
  }, [selectedProfileId])

  useEffect(() => {
    if (!deepLinkSubjectProfileId || !profiles.some((profile) => profile.profile.id === deepLinkSubjectProfileId)) return
    if (role === 'family_member' || activeArea === 'family') {
      setActiveArea('family')
      setSelectedProfileId(deepLinkSubjectProfileId)
    }
  }, [activeArea, deepLinkSubjectProfileId, profiles, role, setActiveArea, setSelectedProfileId])

  useEffect(() => {
    if (!deepLinkMessageId || selectedMessage) return
    const linkedMessage = messages.find((message) => message.id === deepLinkMessageId)
    if (linkedMessage) void loadMessageDetail(linkedMessage.id, linkedMessage)
    else if (loadState === 'ready') void loadMessageDetail(deepLinkMessageId)
  }, [deepLinkMessageId, loadMessageDetail, loadState, messages, selectedMessage])

  useEffect(() => {
    return () => {
      messagesRequestRef.current?.abort()
      messageDetailRequestRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    const handleOffline = () => {
      setLoadError(null)
      setLoadState('offline')
    }
    const handleOnline = () => {
      void loadMessages()
    }
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [loadMessages])

  const handleOpenMessage = useCallback((message: AthleteMessageListItem) => {
    void loadMessageDetail(message.id, message)
  }, [loadMessageDetail])

  const handleReadStateChange = useCallback((state: MessageReadState) => {
    if (!selectedMessage) return
    setMessages((current) => current.map((message) => message.id === selectedMessage.id ? { ...message, is_read: state.is_read, read_state: state } : message))
    setSelectedMessage((current) => current ? { ...current, is_read: state.is_read, read_state: state } : current)
  }, [selectedMessage])

  if (loadState === 'loading' && messages.length === 0) return <LoadingState label="Caricamento messaggi..." />
  if (accessDenied) return <DelegatedAccessDenied section="i messaggi" profileName={selectedProfile ? `${selectedProfile.profile.first_name} ${selectedProfile.profile.last_name}` : undefined} />

  const unreadCount = messages.filter((message) => !message.is_read).length
  const visibleMessages = filterAthleteMessages(messages, readFilter, selectedTeamId)

  return (
    <div className="cs-athlete-messages space-y-6">
      <div className="cs-athlete-messages__heading">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Messaggi</h2>
          <p className="mt-1 text-sm text-secondary">Le comunicazioni della società e delle tue squadre</p>
        </div>
        <span className="cs-athlete-messages__count" aria-live="polite">
          <span className="font-semibold">{unreadCount}</span> {unreadCount === 1 ? 'non letto' : 'non letti'}
        </span>
      </div>

      <div className="cs-athlete-messages__filters" aria-label="Filtri messaggi">
        <div className="cs-athlete-messages__tabs" role="group" aria-label="Filtro lettura">
          <button type="button" className={readFilter === 'all' ? 'is-selected' : ''} aria-pressed={readFilter === 'all'} onClick={() => setReadFilter('all')}>Tutti <span>({messages.length})</span></button>
          <button type="button" className={readFilter === 'unread' ? 'is-selected' : ''} aria-pressed={readFilter === 'unread'} onClick={() => setReadFilter('unread')}>Non letti <span>({unreadCount})</span></button>
        </div>
        {teams.length > 1 ? (
          <div className="cs-athlete-messages__team-filter">
            <label htmlFor="athlete-messages-team">Squadra</label>
            <select id="athlete-messages-team" className="cs-select" value={selectedTeamId ?? ''} onChange={(event) => setSelectedTeamId(event.target.value || null)}>
              <option value="">Tutte le squadre</option>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}{team.code ? ` · ${team.code}` : ''}</option>)}
            </select>
          </div>
        ) : null}
      </div>

      <Panel className="cs-athlete-messages__panel overflow-hidden p-0">
        {loadState === 'offline' ? <OfflineState title="Messaggi non disponibili offline" description="I messaggi richiedono una connessione. Quando torni online, riprova." className="rounded-none border-0" /> : null}
        {loadState === 'error' ? <ErrorState title="Impossibile caricare i messaggi" description={loadError ?? 'Riprova tra poco.'} action={<button type="button" className="cs-btn cs-btn--primary" onClick={() => void loadMessages()}>Riprova</button>} className="rounded-none border-0" /> : null}
        {deepLinkUnavailable ? <FeedbackState variant="error" title="Messaggio non disponibile" description="Il messaggio non è disponibile o non hai accesso a questa comunicazione." className="border-b border-[var(--cs-border-canonical)] text-left" /> : null}
        {loadState === 'ready' && (visibleMessages.length > 0 ? <AthleteMessageList messages={visibleMessages} onOpen={handleOpenMessage} /> : messages.length > 0 ? <EmptyState filtered title="Nessun messaggio corrisponde ai filtri" description="Prova a cambiare il filtro di lettura o la squadra." /> : <EmptyState title="Nessun messaggio" description="Qui troverai i messaggi indirizzati a te o alle tue squadre." />)}
        {loadState !== 'ready' && messages.length > 0 ? <AthleteMessageList messages={visibleMessages} onOpen={handleOpenMessage} /> : null}
      </Panel>

      {selectedMessage && (
        <MessageDetailModal
          open={true}
          onClose={() => setSelectedMessage(null)}
          messageId={selectedMessage.id}
          subjectProfileId={selectedProfileId}
          markAsRead
          readState={selectedMessage.read_state ?? { is_read: selectedMessage.is_read, read_at: null }}
          onReadStateChange={handleReadStateChange}
          data={{
            subject: selectedMessage.subject,
            content: selectedMessage.content,
            created_at: selectedMessage.created_at,
            created_by_profile: selectedMessage.created_by_profile as any || null,
            message_recipients: (selectedMessage.message_recipients as any) || [],
            attachments: (selectedMessage.attachments as any)?.map((a:any)=>({ id: a.id, file_name: a.file_name, download_url: a.download_url })) || []
          }}
        />
      )}
    </div>
  )
}
