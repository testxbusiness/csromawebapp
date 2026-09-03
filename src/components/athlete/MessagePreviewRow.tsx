'use client'

import { ListRow, StatusBadge } from '@/components/ui'

export type MessagePreview = {
  id: string
  subject: string
  content: string
  is_read: boolean
  created_by_profile?: { first_name?: string | null; last_name?: string | null }
  teams?: Array<{ id: string; name: string; code?: string }>
}

export function MessagePreviewRow({ message, onOpen }: { message: MessagePreview; onOpen: () => void }) {
  const sender = message.created_by_profile
    ? `${message.created_by_profile.first_name || ''} ${message.created_by_profile.last_name || ''}`.trim()
    : ''

  return (
    <ListRow
      interactive
      onClick={onOpen}
      aria-label={`${message.is_read ? 'Messaggio letto' : 'Messaggio non letto'}: ${message.subject}`}
      trailing={<div className="flex flex-wrap items-center justify-end gap-2"><StatusBadge status={message.is_read ? 'neutral' : 'info'} label={message.is_read ? 'Letto' : 'Non letto'} /><span className="text-xs text-secondary">Apri</span></div>}
    >
      <span className="font-medium">{message.subject}</span>
      <span className="mt-1 block truncate text-sm text-secondary">
        Da {sender || 'Mittente non disponibile'} · {message.content}
      </span>
      {message.teams && message.teams.length > 0 && <span className="mt-2 flex flex-wrap gap-1">{message.teams.map((team) => <span key={team.id} className="cs-badge cs-badge--neutral">{team.name}</span>)}</span>}
    </ListRow>
  )
}
