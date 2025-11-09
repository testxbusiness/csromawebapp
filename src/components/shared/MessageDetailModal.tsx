'use client'

import * as React from 'react'

type Recipient = {
  id: string
  teams?: { id: string; name: string } | null
  profiles?: { id: string; first_name: string; last_name: string; email?: string } | null
}

export type MessageDetailData = {
  subject?: string
  content?: string
  created_at?: string
  created_by_profile?: { first_name: string; last_name: string } | null
  message_recipients?: Recipient[]
  attachments?: { file_name: string; download_url?: string | null }[]
}

export default function MessageDetailModal({ open, onClose, data }: { open: boolean; onClose: () => void; data: MessageDetailData | null }) {
  const IconX = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/>
    </svg>
  )
  const IconMail = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
      <path d="M4 5h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V7a2 2 0 012-2z" fill="none" stroke="currentColor" strokeWidth={2}/>
      <path d="M22 7l-10 6L2 7" fill="none" stroke="currentColor" strokeWidth={2}/>
    </svg>
  )
  const IconClock = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth={2}/>
      <path d="M12 7v6l4 2" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/>
    </svg>
  )
  const IconUser = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
      <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth={2}/>
      <path d="M4 20a8 8 0 0116 0" fill="none" stroke="currentColor" strokeWidth={2}/>
    </svg>
  )
  const IconPaperclip = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
      <path d="M21.44 11.05l-8.49 8.49a6 6 0 11-8.49-8.49l8.49-8.49a4 4 0 115.66 5.66l-8.49 8.49a2 2 0 11-2.83-2.83l7.07-7.07" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/>
    </svg>
  )

  const recipients = (data?.message_recipients || [])
  const teamBadges = recipients.filter(r => r.teams).map(r => r.teams!.name)
  const userBadges = recipients.filter(r => r.profiles).map(r => `${r.profiles!.first_name} ${r.profiles!.last_name}`)

  return (
    <div className="cs-overlay" aria-hidden={open ? 'false' : 'true'}>
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', padding: 16 }}>
      <section role="dialog" aria-modal="true" className="cs-modal cs-modal--md cs-modal--centered" data-state={open ? 'open' : 'closed'}>
        <button className="cs-modal__close" aria-label="Chiudi" onClick={onClose}><IconX /></button>

        <div className="cs-modal__header" style={{ alignItems: 'center', gap: 12 }}>
          <div className="cs-modal__icon" aria-hidden>✉️</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="cs-modal__title">Dettaglio Messaggio</h2>
            {data?.subject && <div style={{ marginTop: 4, fontWeight: 600 }}>{data.subject}</div>}
          </div>
        </div>

        {!data ? (
          <div className="p-4 text-secondary text-sm">Caricamento…</div>
        ) : (
          <div className="cs-grid" style={{ gap: 16, gridTemplateColumns: '1fr 1fr' }}>
            {/* Mittente */}
            <div>
              <div className="text-secondary" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.02em' }}>Mittente</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconUser />
                <div>{data.created_by_profile ? `${data.created_by_profile.first_name} ${data.created_by_profile.last_name}` : '—'}</div>
              </div>
            </div>

            {/* Data */}
            <div>
              <div className="text-secondary" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.02em' }}>Data</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconClock />
                <div>{data.created_at ? new Date(data.created_at).toLocaleString('it-IT') : '—'}</div>
              </div>
            </div>

            {/* Destinatari squadre */}
            {teamBadges.length > 0 && (
              <div>
                <div className="text-secondary" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.02em' }}>Destinatari (Squadre)</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {teamBadges.map((t, i) => (<span key={i} className="cs-badge cs-badge--neutral">{t}</span>))}
                </div>
              </div>
            )}

            {/* Destinatari utenti */}
            {userBadges.length > 0 && (
              <div>
                <div className="text-secondary" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.02em' }}>Destinatari (Utenti)</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {userBadges.map((u, i) => (<span key={i} className="cs-badge cs-badge--neutral">{u}</span>))}
                </div>
              </div>
            )}

            {/* Contenuto */}
            {data.content && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div className="text-secondary" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.02em' }}>Contenuto</div>
                <p style={{ whiteSpace: 'pre-wrap' }}>{data.content}</p>
              </div>
            )}

            {/* Allegati */}
            {data.attachments && data.attachments.length > 0 && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div className="text-secondary" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.02em' }}>Allegati</div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {data.attachments.map((a, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <IconPaperclip />
                      {a.download_url ? (
                        <a href={a.download_url} className="underline" target="_blank" rel="noreferrer">{a.file_name}</a>
                      ) : (
                        <span>{a.file_name}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
      </div>
    </div>
  )
}
