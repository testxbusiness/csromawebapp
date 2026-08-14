'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import DetailsDrawer from '@/components/shared/DetailsDrawer'
import MessageDetailModal from '@/components/shared/MessageDetailModal'
import DelegatedAccessDenied from './DelegatedAccessDenied'
import { EmptyState, LoadingState } from '@/components/ui'
import { appendSubjectProfile, useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { useAuth } from '@/hooks/useAuth'

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
  const { selectedProfileId, selectedProfile } = useAccessibleProfiles()
  const { role, user, loading: authLoading, profileLoading } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const messagesRequestRef = useRef<AbortController | null>(null)

  const loadMessages = useCallback(async () => {
    if (!user?.id || !role) {
      messagesRequestRef.current?.abort()
      setLoading(false)
      return
    }

    if (authLoading || profileLoading) {
      setLoading(true)
      return
    }
    if (role === 'family_member' && (!selectedProfile || !selectedProfile.relationship.permissions.receive_messages)) {
      setAccessDenied(true)
      setMessages([])
      setLoading(false)
      return
    }
    setLoading(true)
    setAccessDenied(false)
    messagesRequestRef.current?.abort()
    const controller = new AbortController()
    messagesRequestRef.current = controller
    try {
      const res = await fetch(appendSubjectProfile('/api/athlete/messages?view=full', selectedProfileId), {
        signal: controller.signal,
      })
      const result = await res.json()
      if (!res.ok) {
        if (res.status === 403) {
          setAccessDenied(true)
          setMessages([])
          return
        }
        if (res.status === 401) return
        throw new Error(result?.error || 'Errore caricamento messaggi')
      }
      setMessages(result.messages || [])
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      console.error('Errore caricamento messaggi atleta:', e)
      setMessages([])
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [authLoading, profileLoading, role, selectedProfile, selectedProfileId, user?.id])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  useEffect(() => {
    return () => {
      messagesRequestRef.current?.abort()
    }
  }, [])

  if (loading) return <LoadingState label="Caricamento messaggi..." />
  if (accessDenied) return <DelegatedAccessDenied section="i messaggi" profileName={selectedProfile ? `${selectedProfile.profile.first_name} ${selectedProfile.profile.last_name}` : undefined} />

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Messaggi</h2>
      </div>

      <div className="cs-card cs-card--primary overflow-hidden">
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
            <EmptyState title="Nessun messaggio" description="Qui troverai i messaggi indirizzati a te o alle tue squadre." />
          )}
        </div>
        
      </div>

      {selectedMessage && (
        <MessageDetailModal
          open={true}
          onClose={() => setSelectedMessage(null)}
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
