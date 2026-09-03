'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Paperclip } from 'lucide-react'
import { DeniedState, EmptyState, ErrorState, FeedbackState, ListRow, LoadingState, OfflineState, StatusBadge, toast } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import MessageDetailModal from '@/components/shared/MessageDetailModal'
import CoachMessageModal from '@/components/coach/CoachMessageModal'
import MessageReadReport from '@/components/admin/MessageReadReport'
import { useTeamContext } from '@/context/TeamContext'
import { loadStateFromError, loadStateFromStatus, type LoadState } from '@/lib/ui/load-state'

interface Message {
  id: string
  subject: string
  content: string
  attachment_url?: string
  attachments?: { id: string; file_name: string; mime_type?: string; file_size?: number; download_url?: string | null }[]
  created_by?: string
  created_at?: string
  created_by_profile?: { first_name: string; last_name: string; role?: string | null }
  message_recipients?: {
    id: string
    is_read: boolean
    read_at?: string
    teams?: { id: string; name: string }
    profiles?: { id: string; first_name: string; last_name: string; email: string }
  }[]
}

interface Team { id: string; name: string; code: string }

const ROLE_LABELS: Record<string, string> = {
  admin: 'Amministrazione', coach: 'Coach', staff: 'Staff', athlete: 'Atleta', family_member: 'Familiare',
}

function senderName(message: Message) {
  const name = `${message.created_by_profile?.first_name ?? ''} ${message.created_by_profile?.last_name ?? ''}`.trim()
  return name || 'Mittente non disponibile'
}

function senderInitials(message: Message) {
  const name = senderName(message)
  if (name === 'Mittente non disponibile') return '?'
  return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

function relativeDate(value?: string) {
  if (!value) return 'Data non disponibile'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Data non disponibile'
  const diffSeconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (diffSeconds < 60 && diffSeconds >= 0) return 'Adesso'
  if (diffSeconds < 3600 && diffSeconds >= 0) return `${Math.max(1, Math.floor(diffSeconds / 60))} min fa`
  if (diffSeconds < 86400 && diffSeconds >= 0) return `${Math.max(1, Math.floor(diffSeconds / 3600))} or${Math.floor(diffSeconds / 3600) === 1 ? 'a' : 'e'} fa`
  if (diffSeconds < 604800 && diffSeconds >= 0) return `${Math.max(1, Math.floor(diffSeconds / 86400))} giorn${Math.floor(diffSeconds / 86400) === 1 ? 'o' : 'i'} fa`
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function CoachMessageRow({ message, ownProfileId, onOpen, onEdit, onDelete }: {
  message: Message
  ownProfileId: string | null
  onOpen: (message: Message) => void
  onEdit: (message: Message) => void
  onDelete: (id: string) => void
}) {
  const sender = senderName(message)
  const teams = (message.message_recipients ?? []).flatMap((recipient) => recipient.teams ? [recipient.teams] : [])
  const attachmentCount = message.attachments?.length ?? 0
  const isRead = message.created_by === ownProfileId || Boolean(message.message_recipients?.length && message.message_recipients.every((recipient) => recipient.is_read))
  const role = message.created_by_profile?.role ? ROLE_LABELS[message.created_by_profile.role] ?? message.created_by_profile.role : 'Ruolo non disponibile'

  return (
    <li>
      <ListRow
        interactive
        onClick={() => onOpen(message)}
        className="min-h-[76px] gap-3 px-3 py-3 sm:px-4"
        leading={<span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[var(--cs-surface-selected)] text-xs font-bold text-[var(--cs-primary)]">{!isRead ? <span className="absolute -left-1 top-0 h-2.5 w-2.5 rounded-full bg-[var(--cs-brand-red)]" /> : null}{senderInitials(message)}</span>}
        trailing={<div className="flex min-w-[76px] flex-col items-end gap-1 text-right"><time dateTime={message.created_at} className="text-xs text-secondary">{relativeDate(message.created_at)}</time>{!isRead ? <StatusBadge status="info" label="Non letto" /> : null}</div>}
        aria-label={`${isRead ? 'Letto' : 'Non letto'}: ${message.subject}, ${sender}`}
      >
        <div className="min-w-0"><div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"><span className="truncate font-semibold">{sender}</span><span className="text-xs text-secondary">{role}</span></div><div className="mt-1 flex flex-wrap gap-1" aria-label="Squadre destinatarie">{teams.length > 0 ? teams.map((team) => <span key={team.id} className="cs-badge cs-badge--neutral">🏀 {team.name}</span>) : <span className="cs-badge cs-badge--neutral">Destinatario diretto</span>}</div><div className="mt-1 truncate font-medium">{message.subject}</div><div className="line-clamp-2 text-sm text-secondary">{message.content}</div>{attachmentCount > 0 ? <span className="mt-1 inline-flex items-center gap-1 text-xs text-secondary"><Paperclip size={14} aria-hidden="true" /><span>{attachmentCount} {attachmentCount === 1 ? 'allegato' : 'allegati'}</span></span> : null}</div>
      </ListRow>
      {message.created_by === ownProfileId ? <div className="flex justify-end gap-2 border-t border-[var(--cs-border-canonical)] px-3 py-2 sm:px-4"><button type="button" className="cs-btn cs-btn--outline cs-btn--sm" onClick={() => onEdit(message)}>Modifica</button><button type="button" className="cs-btn cs-btn--danger cs-btn--sm" onClick={() => onDelete(message.id)}>Elimina</button></div> : null}
    </li>
  )
}

export default function CoachMessagesManager() {
  const searchParams = useSearchParams()
  const deepLinkMessageId = searchParams.get('messageId')
  const { account } = useAuth()
  const { selectedTeamId, setTeams: setContextTeams } = useTeamContext()
  const ownerProfileId = account?.ownerProfileId || null
  const supabase = useMemo(() => createClient(), [])
  const [messages, setMessages] = useState<Message[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [loadState, setLoadState] = useState<LoadState>('ready')
  const [loadError, setLoadError] = useState<string | null>(null)

  // create/edit modal
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // details (drawer/modale già presente)
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)

  const fetchControllerRef = useRef<AbortController | null>(null)

  const loadTeams = useCallback(async () => {
    if (!ownerProfileId) {
      setTeams([])
      return
    }

    const { data: assignments } = await supabase
      .from('team_coaches')
      .select('team_id')
      .eq('coach_id', ownerProfileId)

    const ids = [...new Set((assignments || []).map(row => row.team_id))]
    if (ids.length === 0) {
      setTeams([])
      return
    }

    const { data } = await supabase
      .from('teams')
      .select('id, name, code')
      .in('id', ids)

    const list = (data || []) as Team[]

    setTeams(list.sort((a, b) => a.name.localeCompare(b.name)))
    setContextTeams(list)
  }, [ownerProfileId, setContextTeams, supabase])

  const loadMessages = useCallback(async (signal?: AbortSignal) => {
    if (!ownerProfileId) {
      setMessages([])
      setLoading(false)
      return
    }

    setLoading(true)
    setLoadState('ready')
    setLoadError(null)
    let classifiedResponseError = false
    try {
      const teamQuery = selectedTeamId ? `&team_id=${encodeURIComponent(selectedTeamId)}` : ''
      const res = await fetch(`/api/coach/messages?view=full${teamQuery}`, {
        signal,
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      const result = await res.json() as { messages?: unknown; error?: string }
      if (!res.ok) {
        classifiedResponseError = true
        setLoadState(loadStateFromStatus(res.status))
        setLoadError(res.status === 403 ? 'Non hai i permessi per visualizzare questi messaggi.' : 'Messaggi non disponibili.')
        console.error('Errore caricamento messaggi coach:', result.error)
      } else {
        setMessages(Array.isArray(result.messages) ? result.messages as Message[] : [])
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return
      if (!classifiedResponseError) setLoadState(loadStateFromError(e))
      setLoadError('Impossibile caricare i messaggi.')
      console.error('Errore rete caricamento messaggi coach:', e)
    } finally {
      setLoading(false)
    }
  }, [ownerProfileId, selectedTeamId])

  useEffect(() => {
    if (!ownerProfileId) {
      setTeams([])
      setMessages([])
      setLoading(false)
      fetchControllerRef.current?.abort()
      fetchControllerRef.current = null
      return
    }

    loadTeams().catch(() => {})

    const controller = new AbortController()
    fetchControllerRef.current?.abort()
    fetchControllerRef.current = controller
    void loadMessages(controller.signal)

    return () => {
      controller.abort()
    }
  }, [ownerProfileId, loadTeams, loadMessages])

  useEffect(() => {
    if (!deepLinkMessageId || selectedMessage) return
    const linkedMessage = messages.find((message) => message.id === deepLinkMessageId)
    if (linkedMessage) setSelectedMessage(linkedMessage)
  }, [deepLinkMessageId, messages, selectedMessage])

  const openCreate = () => {
    setEditingMessage(null)
    setShowModal(true)
  }
  const openEdit = (m: Message) => {
    setEditingMessage(m)
    setShowModal(true)
  }

  const handleCreate = async (payload: {
    subject: string
    content: string
    attachment_url?: string
    selected_teams: string[]
    attachments?: { file_path: string; file_name: string; mime_type?: string; file_size?: number }[]
  }) => {
    try {
      setSubmitting(true)
      const res = await fetch('/api/coach/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (!res.ok) {
        toast.error(result.error || 'Errore creazione messaggio')
        return
      }
      setShowModal(false)
      setEditingMessage(null)
      await loadMessages()
    } catch {
      toast.error('Errore di rete durante la creazione')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async (
    id: string,
    payload: { subject: string; content: string; attachment_url?: string; selected_teams: string[]; attachments?: { file_path: string; file_name: string; mime_type?: string; file_size?: number }[] }
  ) => {
    try {
      setSubmitting(true)
      const res = await fetch('/api/coach/messages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...payload }),
      })
      const result = await res.json()
      if (!res.ok) {
        toast.error(result.error || 'Errore aggiornamento messaggio')
        return
      }
      setShowModal(false)
      setEditingMessage(null)
      await loadMessages()
    } catch {
      toast.error('Errore di rete durante l\'aggiornamento')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminare questo messaggio?')) return
    try {
      const res = await fetch(`/api/coach/messages?id=${id}`, { method: 'DELETE' })
      const result = await res.json()
      if (!res.ok) {
        toast.error(result.error || 'Errore eliminazione messaggio')
        return
      }
      await loadMessages()
    } catch {
      toast.error('Errore di rete durante l\'eliminazione')
    }
  }

  if (loading) return <LoadingState label="Caricamento messaggi..." />

  return (
    <div className="space-y-6">
      {loadError && messages.length > 0 ? <FeedbackState variant={loadState === 'denied' ? 'denied' : loadState === 'offline' ? 'offline' : 'error'} title="Aggiornamento parziale" description={loadState === 'denied' ? 'Alcuni messaggi non sono disponibili per il tuo account.' : loadState === 'offline' ? 'I messaggi visualizzati potrebbero non essere aggiornati.' : loadError} /> : null}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Messaggi</h2>
        <button onClick={openCreate} className="cs-btn cs-btn--primary">
          Nuovo Messaggio
        </button>
      </div>

      <div className="cs-card cs-card--primary overflow-hidden">
        {messages.length > 0 ? (
          <ul className="m-0 list-none divide-y divide-[var(--cs-border-canonical)] p-0" aria-label="Lista messaggi coach">
            {messages.map((message) => (
              <CoachMessageRow key={message.id} message={message} ownProfileId={ownerProfileId} onOpen={setSelectedMessage} onEdit={openEdit} onDelete={handleDelete} />
            ))}
          </ul>
        ) : loadError && messages.length === 0 ? (
          loadState === 'denied' ? <DeniedState title="Messaggi non disponibili" description={loadError} action={<button type="button" className="cs-btn cs-btn--outline" onClick={() => void loadMessages()}>Riprova</button>} />
            : loadState === 'offline' ? <OfflineState title="Messaggi non disponibili offline" description="Controlla la connessione e riprova." action={<button type="button" className="cs-btn cs-btn--outline" onClick={() => void loadMessages()}>Riprova</button>} />
              : <ErrorState title="Messaggi non disponibili" description={loadError} action={<button type="button" className="cs-btn cs-btn--outline" onClick={() => void loadMessages()}>Riprova</button>} />
        ) : (
          <EmptyState filtered={Boolean(selectedTeamId)} title={selectedTeamId ? 'Nessun messaggio per questa squadra' : 'Nessun messaggio'} description={selectedTeamId ? 'Prova a selezionare Tutte le squadre.' : 'Crea un messaggio per le tue squadre.'} />
        )}
      </div>

      {/* Modal crea/modifica */}
      <CoachMessageModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditingMessage(null) }}
        message={editingMessage}
        teams={teams}
        loading={submitting}
        onSubmit={(data) => {
          if (editingMessage) return handleUpdate(editingMessage.id, data)
          return handleCreate(data)
        }}
      />

      {/* Dettaglio messaggio (drawer/modale già esistente) */}
      {selectedMessage && (
        <MessageDetailModal
          open={true}
          onClose={() => setSelectedMessage(null)}
          messageId={selectedMessage.id}
          markAsRead={selectedMessage.created_by !== ownerProfileId}
          extraContent={
            selectedMessage.created_by === ownerProfileId
              ? <MessageReadReport messageId={selectedMessage.id} />
              : undefined
          }
          data={{
            subject: selectedMessage.subject,
            content: selectedMessage.content,
            created_at: selectedMessage.created_at,
            created_by_profile: selectedMessage.created_by_profile || null,
            message_recipients: (selectedMessage.message_recipients as any) || [],
            attachments: (selectedMessage.attachments as any)?.map((a:any)=>({ file_name: a.file_name, download_url: a.download_url })) || []
          }}
        />
      )}
    </div>
  )
}
