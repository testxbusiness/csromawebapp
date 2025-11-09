'use client'

import * as React from 'react'
import Link from 'next/link'

type MessageItem = {
  id: string
  subject: string
  preview?: string
  created_at?: Date
  from?: string
}

export default function LatestMessagesPanel({
  title = 'Ultimi Messaggi',
  items,
  emptyText = 'Nessun messaggio',
  viewAllHref,
  onDetail,
}: {
  title?: string
  items: MessageItem[]
  emptyText?: string
  viewAllHref: string
  onDetail: (id: string) => void
}) {
  const initials = (name?: string) => {
    const src = (name && name.trim()) || '?'
    if (src === '?') return '?'
    return src.split(' ').filter(Boolean).slice(0,2).map(s=>s[0]!.toUpperCase()).join('')
  }

  return (
    <div className="cs-card cs-card--primary">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">{title}</h3>
        <Link href={viewAllHref} className="cs-btn cs-btn--ghost cs-btn--sm">Vedi tutti</Link>
      </div>

      {items.length === 0 ? (
        <p className="text-secondary text-sm">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {items.map((m) => (
            <div key={m.id} className="cs-card p-3 flex items-start gap-3">
              <div className="cs-avatar" aria-hidden style={{ width: 32, height: 32 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{initials(m.from)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-medium truncate">{m.subject}</div>
                  {m.created_at && (
                    <span className="text-xs text-secondary">{m.created_at.toLocaleDateString('it-IT')}</span>
                  )}
                </div>
                <div className="text-sm text-secondary truncate">
                  {m.from ? (<><span className="font-medium">Da {m.from}</span> · </>) : null}
                  {m.preview || ''}
                </div>
              </div>
              <div>
                <button className="cs-btn cs-btn--outline cs-btn--sm" onClick={() => onDetail(m.id)}>Dettagli</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
