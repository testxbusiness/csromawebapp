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

  return (
    <section className="mt-5 border-t pt-4" aria-labelledby="message-read-report-title">
      <div className="flex items-center justify-between gap-3">
        <h3 id="message-read-report-title" className="font-semibold">Report letture</h3>
        <span className="text-sm text-secondary">
          {report.summary.read_count} letti · {report.summary.unread_count} non letti
        </span>
      </div>
      <p className="mt-1 text-xs text-secondary">
        Conteggio basato sulle letture account registrate. I destinatari squadra sono espansi sui relativi account.
      </p>
      {report.summary.delegated_read_count > 0 && (
        <p className="mt-1 text-xs text-secondary">
          Letture delegate registrate: {report.summary.delegated_read_count}
        </p>
      )}
      <div className="mt-3 max-h-56 overflow-auto rounded border">
        {report.recipients.length === 0 ? (
          <p className="p-3 text-sm text-secondary">Nessun destinatario account tracciabile.</p>
        ) : (
          <ul className="divide-y">
            {report.recipients.map((recipient) => (
              <li key={recipient.profile_id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{recipient.first_name} {recipient.last_name}</div>
                  <div className="truncate text-xs text-secondary">
                    {recipient.source === 'team' ? `Squadra: ${recipient.teams.join(', ') || '—'}` : 'Destinatario diretto'}
                    {recipient.email ? ` · ${recipient.email}` : ''}
                  </div>
                </div>
                <div className={recipient.read ? 'text-green-700' : 'text-secondary'}>
                  {recipient.read
                    ? `${recipient.read_by === 'delegated' ? 'Letto da delegato' : 'Letto'}${recipient.read_at ? ` · ${new Date(recipient.read_at).toLocaleString('it-IT')}` : ''}`
                    : 'Non letto'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
