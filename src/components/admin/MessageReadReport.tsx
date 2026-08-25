'use client'

import { useEffect, useState } from 'react'
import { LoadingState } from '@/components/ui'

type ReportRecipient = {
  profile_id: string
  first_name: string
  last_name: string
  email: string | null
  source: 'direct' | 'team'
  teams: string[]
  read: boolean
  read_at: string | null
  read_by: 'account' | 'delegated' | null
}

type Report = {
  summary: {
    tracked_recipient_count: number
    read_count: number
    unread_count: number
    delegated_read_count: number
  }
  recipients: ReportRecipient[]
}

function recipientDetails(recipient: ReportRecipient) {
  const source = recipient.source === 'team'
    ? `Squadra: ${recipient.teams.join(', ') || '—'}`
    : 'Destinatario diretto'

  return `${source}${recipient.email ? ` · ${recipient.email}` : ''}`
}

function recipientStatus(recipient: ReportRecipient) {
  if (!recipient.read) return 'Non letto'

  const label = recipient.read_by === 'delegated' ? 'Letto da delegato' : 'Letto'
  return `${label}${recipient.read_at ? ` · ${new Date(recipient.read_at).toLocaleString('it-IT')}` : ''}`
}

function RecipientCard({
  title,
  entries,
  emptyLabel,
}: {
  title: string
  entries: ReportRecipient[]
  emptyLabel: string
}) {
  return (
    <div className="cs-card cs-card--primary p-3">
      <div className="mb-2 text-sm font-semibold">{title} ({entries.length})</div>
      {entries.length === 0 ? (
        <div className="text-sm text-secondary">{emptyLabel}</div>
      ) : (
        <ul className="max-h-48 space-y-2 overflow-y-auto pr-1" aria-label={title}>
          {entries.map((recipient) => (
            <li key={`${title}-${recipient.profile_id}`} className="text-sm">
              <div className="font-medium">{recipient.first_name} {recipient.last_name}</div>
              <div className="truncate text-xs text-secondary">{recipientDetails(recipient)}</div>
              <div className={recipient.read ? 'text-xs text-green-700' : 'text-xs text-secondary'}>
                {recipientStatus(recipient)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function MessageReadReport({ messageId }: { messageId: string }) {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    fetch(`/api/admin/messages/${messageId}/read-report`, { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Errore caricamento report')
        return result as Report
      })
      .then((result) => {
        if (active) setReport(result)
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Errore caricamento report')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [messageId])

  if (loading) return <LoadingState label="Caricamento letture..." />
  if (error) return <p className="text-sm text-secondary">{error}</p>
  if (!report) return null

  const readRecipients = report.recipients.filter((recipient) => recipient.read)
  const unreadRecipients = report.recipients.filter((recipient) => !recipient.read)
  const delegatedRecipients = report.recipients.filter((recipient) => recipient.read_by === 'delegated')
  const directRecipients = report.recipients.filter((recipient) => recipient.source === 'direct')
  const teamRecipients = report.recipients.filter((recipient) => recipient.source === 'team')

  return (
    <section className="mt-5 border-t border-[color:var(--cs-border)] pt-4" aria-labelledby="message-read-report-title">
      <div className="flex items-center justify-between gap-3">
        <h3 id="message-read-report-title" className="font-semibold">Report letture</h3>
        <span className="text-sm text-secondary">
          {report.summary.read_count} letti · {report.summary.unread_count} non letti
        </span>
      </div>
      <p className="mt-1 text-xs text-secondary">
        Conteggio basato sulle letture account registrate. I destinatari squadra sono espansi sui relativi account.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
        <RecipientCard
          title="Letti"
          entries={readRecipients}
          emptyLabel="Nessun destinatario ha ancora letto il messaggio."
        />
        <RecipientCard
          title="Non letti"
          entries={unreadRecipients}
          emptyLabel="Tutti i destinatari hanno letto il messaggio."
        />
        <RecipientCard
          title="Letture delegate"
          entries={delegatedRecipients}
          emptyLabel="Nessuna lettura delegata registrata."
        />
        <div className="cs-card cs-card--primary p-3">
          <div className="mb-2 text-sm font-semibold">Destinatari tracciati ({report.summary.tracked_recipient_count})</div>
          {report.recipients.length === 0 ? (
            <div className="text-sm text-secondary">Nessun destinatario account tracciabile.</div>
          ) : (
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-secondary">Destinatari diretti</dt>
                <dd className="font-medium">{directRecipients.length}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-secondary">Destinatari da squadra</dt>
                <dd className="font-medium">{teamRecipients.length}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-secondary">Letture delegate</dt>
                <dd className="font-medium">{report.summary.delegated_read_count}</dd>
              </div>
              <p className="pt-1 text-xs text-secondary">
                Le letture delegate sono incluse nel conteggio “Letti”.
              </p>
            </dl>
          )}
        </div>
      </div>
    </section>
  )
}
