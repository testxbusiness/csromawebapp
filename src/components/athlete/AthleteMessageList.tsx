'use client'

import { Paperclip } from 'lucide-react'
import { ListRow, StatusBadge } from '@/components/ui'

export type AthleteMessageListItem = {
  id: string
  subject: string
  content: string
  created_at: string
  is_read: boolean
  read_state?: { is_read: boolean; read_at: string | null }
  created_by_profile?: {
    first_name?: string | null
    last_name?: string | null
    role?: string | null
  } | null
  teams?: Array<{ id: string; name: string; code?: string | null }>
  message_recipients?: Array<{ teams?: { id: string; name: string } | null }>
  attachments?: Array<{ id: string; file_name: string }>
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Amministrazione',
  coach: 'Coach',
  staff: 'Staff',
  athlete: 'Atleta',
  family_member: 'Familiare',
}

function senderName(message: AthleteMessageListItem) {
  const name = `${message.created_by_profile?.first_name ?? ''} ${message.created_by_profile?.last_name ?? ''}`.trim()
  return name || 'Mittente non disponibile'
}

function initials(message: AthleteMessageListItem) {
  const name = senderName(message)
  if (name === 'Mittente non disponibile') return '?'
  return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

function relativeDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Data non disponibile'
  const diffSeconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (diffSeconds < 60 && diffSeconds >= 0) return 'Adesso'
  if (diffSeconds < 3600 && diffSeconds >= 0) return `${Math.max(1, Math.floor(diffSeconds / 60))} min fa`
  if (diffSeconds < 86400 && diffSeconds >= 0) return `${Math.max(1, Math.floor(diffSeconds / 3600))} or${Math.floor(diffSeconds / 3600) === 1 ? 'a' : 'e'} fa`
  if (diffSeconds < 604800 && diffSeconds >= 0) return `${Math.max(1, Math.floor(diffSeconds / 86400))} giorn${Math.floor(diffSeconds / 86400) === 1 ? 'o' : 'i'} fa`
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function AthleteMessageList({ messages, onOpen }: { messages: AthleteMessageListItem[]; onOpen: (message: AthleteMessageListItem) => void }) {
  return (
    <ul className="m-0 list-none divide-y divide-[var(--cs-border-canonical)] p-0" aria-label="Lista messaggi">
      {messages.map((message) => {
        const sender = senderName(message)
        const role = message.created_by_profile?.role ? ROLE_LABELS[message.created_by_profile.role] ?? message.created_by_profile.role : 'Ruolo non disponibile'
        const teams = message.teams ?? message.message_recipients?.flatMap((recipient) => recipient.teams ? [recipient.teams] : []) ?? []
        const attachmentCount = message.attachments?.length ?? 0
        return (
          <li key={message.id}>
            <ListRow
              interactive
              onClick={() => onOpen(message)}
              className="min-h-[76px] gap-3 px-3 py-3 sm:px-4"
              leading={
                <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[var(--cs-surface-selected)] text-xs font-bold text-[var(--cs-primary)]" aria-hidden="true">
                  {!message.is_read ? <span className="absolute -left-1 top-0 h-2.5 w-2.5 rounded-full bg-[var(--cs-brand-red)]" /> : null}
                  {initials(message)}
                </span>
              }
              trailing={
                <div className="flex min-w-[76px] flex-col items-end gap-1 text-right">
                  <time dateTime={message.created_at} className="text-xs text-secondary">{relativeDate(message.created_at)}</time>
                  {!message.is_read ? <StatusBadge status="info" label="Non letto" /> : null}
                </div>
              }
              aria-label={`${message.is_read ? 'Letto' : 'Non letto'}: ${message.subject}, ${sender}`}
            >
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="truncate font-semibold">{sender}</span>
                  <span className="text-xs text-secondary">{role}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1" aria-label="Squadre o destinatari pertinenti">
                  {teams.length > 0
                    ? teams.map((team) => <span key={team.id} className="cs-badge cs-badge--neutral">{team.name}</span>)
                    : <span className="cs-badge cs-badge--neutral">A te</span>}
                </div>
                <div className="mt-1 truncate font-medium">{message.subject}</div>
                <div className="line-clamp-2 text-sm text-secondary">{message.content}</div>
                {attachmentCount > 0 ? (
                  <span className="mt-1 inline-flex items-center gap-1 text-xs text-secondary">
                    <Paperclip size={14} aria-hidden="true" />
                    <span>{attachmentCount} {attachmentCount === 1 ? 'allegato' : 'allegati'}</span>
                  </span>
                ) : null}
              </div>
            </ListRow>
          </li>
        )
      })}
    </ul>
  )
}
