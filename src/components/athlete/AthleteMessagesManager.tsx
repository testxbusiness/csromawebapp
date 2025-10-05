'use client'

import { useEffect, useState } from 'react'
import DetailsDrawer from '@/components/shared/DetailsDrawer'

type Message = {
  id: string
  subject: string
  content: string
  created_at: string
  created_by?: string
  created_by_profile?: { first_name: string; last_name: string }
  attachments?: { id: string; file_name: string; mime_type?: string; file_size?: number; download_url?: string | null }[]
  message_recipients?: {
    id: string
    is_read: boolean
    read_at?: string
    teams?: { id: string; name: string }
    profiles?: { id: string; first_name: string; last_name: string; email?: string }
  }[]
}

export default function AthleteMessagesManager() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)

  useEffect(() => {
    loadMessages()
  }, [])

  const loadMessages = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/athlete/messages?view=full')
      const result = await res.json()
      if (!res.ok) throw new Error(result?.error || 'Errore caricamento messaggi')
      setMessages(result.messages || [])
    } catch (e) {
      console.error('Errore caricamento messaggi atleta:', e)
      setMessages([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="p-4">Caricamento messaggi...</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Messaggi</h2>
      </div>

      <div className="cs-card overflow-hidden">
        {/* Desktop */}
        <div className="hidden md:block">
        <table className="cs-table">
          <thead>
            <tr>
              <th>Oggetto</th>
              <th>Mittente</th>
              <th>Data</th>
              <th>Destinatari</th>
            </tr>
          </thead>
          <tbody>
            {messages.map((m) => (
              <tr key={m.id} className="cursor-pointer" onClick={() => setSelectedMessage(m)}>
                <td>
                  <div className="font-medium">{m.subject}</div>
                  <div className="text-secondary text-sm line-clamp-2">{m.content}</div>
                  {(m as any).attachments && (m as any).attachments.length > 0 && (
                    <div className="mt-1 text-xs text-secondary">Allegati: {(m as any).attachments.length}</div>
                  )}
                </td>
                <td>
                  <div>
                    {m.created_by_profile ? `${m.created_by_profile.first_name} ${m.created_by_profile.last_name}` : 'N/D'}
                  </div>
                </td>
                <td>
                  <div>{m.created_at ? new Date(m.created_at).toLocaleDateString('it-IT') : 'N/D'}</div>
                  <div className="text-xs text-secondary">{m.created_at ? new Date(m.created_at).toLocaleTimeString('it-IT') : ''}</div>
                </td>
                <td>
                  <div>
                    {m.message_recipients && m.message_recipients.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {m.message_recipients.map((mr) => (
                          <span key={mr.id} className="cs-badge cs-badge--neutral">
                            {mr.teams ? `🏀 ${mr.teams.name}` : mr.profiles ? `👤 ${mr.profiles.first_name} ${mr.profiles.last_name}` : '—'}
                          </span>
                        ))}
                      </div>
                    ) : 'Nessun destinatario visibile'}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden p-4 space-y-3">
          {messages.map((m) => (
            <button key={m.id} className="cs-card text-left w-full" onClick={() => setSelectedMessage(m)}>
              <div className="font-semibold">{m.subject}</div>
              <div className="text-sm text-secondary line-clamp-3">{m.content}</div>
              <div className="mt-2 grid gap-1 text-sm">
                <div><strong>Mittente:</strong> {m.created_by_profile ? `${m.created_by_profile.first_name} ${m.created_by_profile.last_name}` : 'N/D'}</div>
                <div>
                  <strong>Data:</strong> {m.created_at ? new Date(m.created_at).toLocaleDateString('it-IT') : 'N/D'}
                  <span className="text-secondary ml-2">{m.created_at ? new Date(m.created_at).toLocaleTimeString('it-IT') : ''}</span>
                </div>
                <div>
                  <strong>Destinatari:</strong>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {m.message_recipients && m.message_recipients.length > 0 ? (
                      m.message_recipients.map((mr) => (
                        <span key={mr.id} className="cs-badge cs-badge--neutral">
                          {mr.teams ? `🏀 ${mr.teams.name}` : mr.profiles ? `👤 ${mr.profiles.first_name} ${mr.profiles.last_name}` : '—'}
                        </span>
                      ))
                    ) : (
                      <span className="text-secondary">Nessun destinatario visibile</span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
          {messages.length === 0 && (
            <div className="px-6 py-8 text-center">
              <div className="text-secondary mb-4"><span className="text-4xl">✉️</span></div>
              <h3 className="text-lg font-semibold mb-2">Nessun messaggio</h3>
              <p className="text-secondary">Qui troverai i messaggi indirizzati a te o alle tue squadre.</p>
            </div>
          )}
        </div>
        
      </div>

      {selectedMessage && (
        <DetailsDrawer open={true} title="Dettaglio Messaggio" onClose={() => setSelectedMessage(null)}>
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs text-secondary">Oggetto</div>
              <div className="font-medium">{selectedMessage.subject}</div>
            </div>
            <div>
              <div className="text-xs text-secondary">Data</div>
              <div>{new Date(selectedMessage.created_at || '').toLocaleString('it-IT')}</div>
            </div>
            <div>
              <div className="text-xs text-secondary">Contenuto</div>
              <div className="whitespace-pre-wrap">{selectedMessage.content}</div>
            </div>
            {selectedMessage.created_by_profile && (
              <div>
              <div className="text-xs text-secondary">Mittente</div>
                <div>{selectedMessage.created_by_profile.first_name} {selectedMessage.created_by_profile.last_name}</div>
              </div>
            )}
            {(selectedMessage as any).attachments && (selectedMessage as any).attachments.length > 0 && (
              <div>
                <div className="text-xs text-secondary">Allegati</div>
                <div className="mt-1 space-y-1">
                  {(selectedMessage as any).attachments.map((a: any) => (
                    <div key={a.id}>
                      <a href={a.download_url} target="_blank" rel="noopener noreferrer" className="underline">
                        {a.file_name}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selectedMessage.message_recipients && selectedMessage.message_recipients.length > 0 && (
              <div>
                <div className="text-xs text-secondary mb-1">Destinatari</div>
                <div className="flex flex-wrap gap-1">
                  {selectedMessage.message_recipients.map((mr) => (
                    <span key={mr.id} className="cs-badge cs-badge--neutral">
                      {mr.teams ? `🏀 ${mr.teams.name}` : mr.profiles ? `👤 ${mr.profiles.first_name} ${mr.profiles.last_name}` : '—'}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DetailsDrawer>
      )}
    </div>
  )
}
