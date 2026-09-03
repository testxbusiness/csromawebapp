'use client'

import * as React from 'react'
import { Clock3, Paperclip, UserRound } from 'lucide-react'
import { ResponsiveDetail, StatusBadge } from '@/components/ui'
import { emitMessageReadStateChanged } from '@/lib/messages/read-state-events'

export type MessageReadState = { is_read: boolean; read_at: string | null }

type Recipient = {
  id: string
  teams?: { id: string; name: string } | null
  profiles?: { id: string; first_name: string; last_name: string; email?: string } | null
}

export type MessageDetailData = {
  subject?: string
  content?: string
  created_at?: string
  created_by_profile?: { first_name: string; last_name: string; role?: string | null } | null
  message_recipients?: Recipient[]
  attachments?: { id?: string; file_name: string; download_url?: string | null }[]
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Amministrazione',
  coach: 'Coach',
  staff: 'Staff',
  athlete: 'Atleta',
  family_member: 'Familiare',
}

function senderName(profile: MessageDetailData['created_by_profile']) {
  return profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Mittente non disponibile' : 'Mittente non disponibile'
}

export default function MessageDetailModal({
  open,
  onClose,
  data,
  messageId,
  subjectProfileId,
  markAsRead = false,
  readState,
  onReadStateChange,
  extraContent,
}: {
  open: boolean
  onClose: () => void
  data: MessageDetailData | null
  messageId?: string
  subjectProfileId?: string | null
  markAsRead?: boolean
  readState?: MessageReadState
  onReadStateChange?: (state: MessageReadState) => void
  extraContent?: React.ReactNode
}) {
  const [readRequest, setReadRequest] = React.useState<'idle' | 'loading' | 'error'>('idle')
  const [attachmentUrls, setAttachmentUrls] = React.useState<Record<string, string>>({})
  const [attachmentLoading, setAttachmentLoading] = React.useState<string | null>(null)
  const [attachmentError, setAttachmentError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open || !markAsRead || !messageId || readState?.is_read) return
    let active = true
    setReadRequest('loading')
    void fetch('/api/messages/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_id: messageId, subject_profile_id: subjectProfileId || undefined }),
    })
      .then(async (response) => {
        const result = await response.json().catch(() => null)
        if (!response.ok || !result?.read_state?.is_read) throw new Error('Lettura non confermata')
        if (!active) return
        setReadRequest('idle')
        onReadStateChange?.({ is_read: true, read_at: result.read_state.read_at ?? null })
        emitMessageReadStateChanged({ messageId, subjectProfileId: subjectProfileId ?? null })
      })
      .catch(() => {
        if (active) setReadRequest('error')
      })
    return () => { active = false }
  }, [markAsRead, messageId, onReadStateChange, open, readState?.is_read, subjectProfileId])

  const loadAttachment = async (attachmentId: string) => {
    setAttachmentLoading(attachmentId)
    setAttachmentError(null)
    try {
      const response = await fetch(`/api/athlete/messages/attachments/${attachmentId}?${subjectProfileId ? `subjectProfileId=${encodeURIComponent(subjectProfileId)}` : ''}`, { cache: 'no-store' })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.attachment?.download_url) throw new Error('Allegato non disponibile')
      setAttachmentUrls((current) => ({ ...current, [attachmentId]: result.attachment.download_url }))
    } catch {
      setAttachmentError(attachmentId)
    } finally {
      setAttachmentLoading(null)
    }
  }

  const recipients = data?.message_recipients ?? []
  const teamNames = [...new Set(recipients.flatMap((recipient) => recipient.teams ? [recipient.teams.name] : []))]
  const userNames = [...new Set(recipients.flatMap((recipient) => recipient.profiles ? [`${recipient.profiles.first_name} ${recipient.profiles.last_name}`.trim()] : []))]
  const sender = senderName(data?.created_by_profile ?? null)
  const role = data?.created_by_profile?.role ? ROLE_LABELS[data.created_by_profile.role] ?? data.created_by_profile.role : null
  const isRead = readState?.is_read === true

  return (
    <ResponsiveDetail
      open={open}
      onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}
      title={data?.subject ?? 'Dettaglio messaggio'}
      description="Messaggio e destinatari pertinenti"
      fullscreenOnMobile
      size="md"
    >
      {!data ? (
        <div className="py-8 text-center text-secondary">Caricamento messaggio...</div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--cs-border-canonical)] pb-4">
            <StatusBadge status={isRead ? 'success' : 'info'} label={isRead ? 'Letto' : 'Non letto'} />
            {readRequest === 'loading' ? <span className="text-sm text-secondary">Salvataggio lettura…</span> : null}
            {readRequest === 'error' ? <span role="alert" className="text-sm text-[var(--cs-danger-canonical)]">Lettura non sincronizzata</span> : null}
          </div>

          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-secondary">Mittente</dt>
              <dd className="mt-1 flex items-center gap-2"><UserRound size={17} aria-hidden="true" />{sender}{role ? <span className="text-sm text-secondary">· {role}</span> : null}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-secondary">Data completa</dt>
              <dd className="mt-1 flex items-center gap-2"><Clock3 size={17} aria-hidden="true" />{data.created_at ? new Date(data.created_at).toLocaleString('it-IT') : 'Data non disponibile'}</dd>
            </div>
            {readState?.read_at ? <div><dt className="text-xs font-bold uppercase tracking-wide text-secondary">Letto il</dt><dd className="mt-1">{new Date(readState.read_at).toLocaleString('it-IT')}</dd></div> : null}
          </dl>

          {teamNames.length > 0 || userNames.length > 0 ? (
            <section aria-labelledby="message-detail-recipients-title">
              <h3 id="message-detail-recipients-title" className="text-xs font-bold uppercase tracking-wide text-secondary">Destinatari pertinenti</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {teamNames.map((name) => <span key={`team-${name}`} className="cs-badge cs-badge--neutral">{name}</span>)}
                {userNames.map((name) => <span key={`user-${name}`} className="cs-badge cs-badge--neutral">{name}</span>)}
              </div>
            </section>
          ) : null}

          <section aria-labelledby="message-detail-content-title">
            <h3 id="message-detail-content-title" className="text-xs font-bold uppercase tracking-wide text-secondary">Contenuto</h3>
            <p className="mt-2 whitespace-pre-wrap leading-relaxed">{data.content || 'Nessun contenuto disponibile.'}</p>
          </section>

          {data.attachments && data.attachments.length > 0 ? (
            <section aria-labelledby="message-detail-attachments-title">
              <h3 id="message-detail-attachments-title" className="text-xs font-bold uppercase tracking-wide text-secondary">Allegati</h3>
              <ul className="mt-2 space-y-2">
                {data.attachments.map((attachment) => {
                  const attachmentId = attachment.id
                  const downloadUrl = attachment.download_url || (attachmentId ? attachmentUrls[attachmentId] : undefined)
                  return <li key={attachment.id ?? attachment.file_name} className="flex flex-wrap items-center gap-2"><Paperclip size={16} aria-hidden="true" />{downloadUrl ? <a className="underline" href={downloadUrl} target="_blank" rel="noreferrer">{attachment.file_name}</a> : attachmentId ? <button type="button" className="underline" onClick={() => loadAttachment(attachmentId)} disabled={attachmentLoading === attachmentId}>{attachmentLoading === attachmentId ? 'Caricamento…' : attachment.file_name}</button> : <span>{attachment.file_name}</span>}{attachmentError === attachmentId ? <span role="alert" className="text-sm text-[var(--cs-danger-canonical)]">Allegato non disponibile</span> : null}</li>
                })}
              </ul>
            </section>
          ) : null}
          {extraContent}
        </div>
      )}
    </ResponsiveDetail>
  )
}
