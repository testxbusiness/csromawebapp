'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import DetailsDrawer from '@/components/shared/DetailsDrawer'
import CoachMessageModal from '@/components/coach/CoachMessageModal'

interface Message {
  id: string
  subject: string
  content: string
  attachment_url?: string
  attachments?: { id: string; file_name: string; mime_type?: string; file_size?: number; download_url?: string | null }[]
  created_by?: string
  created_at?: string
  created_by_profile?: { first_name: string; last_name: string }
  message_recipients?: {
    id: string
    is_read: boolean
    read_at?: string
    teams?: { id: string; name: string }
    profiles?: { id: string; first_name: string; last_name: string; email: string }
  }[]
}

interface Team { id: string; name: string; code: string }

export default function CoachMessagesManager() {
  const { user } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  const [messages, setMessages] = useState<Message[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)

  // create/edit modal
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // details (drawer/modale già presente)
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)

  useEffect(() => {
    if (!user) return
    loadTeams()
    loadMessages()
  }, [user])

  const loadTeams = async () => {
    const { data } = await supabase
      .from('team_coaches')
      .select('team_id, teams(id, name, code)')
      .eq('coach_id', user!.id)

    const list = (data || [])
      .map((row) => row.teams)
      .filter(Boolean) as Team[]

    setTeams(list.sort((a, b) => a.name.localeCompare(b.name)))
  }

  const loadMessages = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/coach/messages?view=full')
      const result = await res.json()
      if (!res.ok) {
        console.error('Errore caricamento messaggi coach:', result.error)
        setMessages([])
      } else {
        setMessages(result.messages || [])
      }
    } catch (e) {
      console.error('Errore rete caricamento messaggi coach:', e)
      setMessages([])
    } finally {
      setLoading(false)
    }
  }

  const canEdit = (m: Message) => m.created_by === user?.id

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
        alert(result.error || 'Errore creazione messaggio')
        return
      }
      setShowModal(false)
      setEditingMessage(null)
      await loadMessages()
    } catch {
      alert('Errore di rete durante la creazione')
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
        alert(result.error || 'Errore aggiornamento messaggio')
        return
      }
      setShowModal(false)
      setEditingMessage(null)
      await loadMessages()
    } catch {
      alert('Errore di rete durante l\'aggiornamento')
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
        alert(result.error || 'Errore eliminazione messaggio')
        return
      }
      await loadMessages()
    } catch {
      alert('Errore di rete durante l\'eliminazione')
    }
  }

  if (loading) return <div className="cs-card" style={{ padding: 24 }}>Caricamento messaggi…</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Messaggi</h2>
        <button onClick={openCreate} className="cs-btn cs-btn--primary">
          Nuovo Messaggio
        </button>
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
              <th>Azioni</th>
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
                    {m.created_by_profile
                      ? `${m.created_by_profile.first_name} ${m.created_by_profile.last_name}`
                      : 'N/D'}
                  </div>
                </td>
                <td>
                  <div>{m.created_at ? new Date(m.created_at).toLocaleDateString('it-IT') : 'N/D'}</div>
                  <div className="text-xs text-secondary">
                    {m.created_at ? new Date(m.created_at).toLocaleTimeString('it-IT') : ''}
                  </div>
                </td>
                <td>
                  <div>
                    {m.message_recipients && m.message_recipients.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {m.message_recipients.map((mr) => (
                          <span key={mr.id} className="cs-badge cs-badge--neutral">
                            {mr.teams
                              ? `🏀 ${mr.teams.name}`
                              : mr.profiles
                              ? `👤 ${mr.profiles.first_name} ${mr.profiles.last_name}`
                              : '—'}
                          </span>
                        ))}
                      </div>
                    ) : (
                      'Nessun destinatario'
                    )}
                  </div>
                </td>
                <td className="cs-table__actions">
                  {canEdit(m) ? (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(m) }}
                        className="cs-btn cs-btn--outline cs-btn--sm"
                      >
                        Modifica
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(m.id) }}
                        className="cs-btn cs-btn--danger cs-btn--sm"
                      >
                        Elimina
                      </button>
                    </>
                  ) : (
                    <span className="text-secondary">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden p-4 space-y-3">
          {messages.map((m) => (
            <div key={m.id} className="cs-card">
              <button className="text-left w-full" onClick={() => setSelectedMessage(m)}>
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
                        <span className="text-secondary">Nessun destinatario</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
              <div className="mt-3 flex gap-2">
                {canEdit(m) ? (
                  <>
                    <button onClick={() => openEdit(m)} className="cs-btn cs-btn--outline cs-btn--sm flex-1">Modifica</button>
                    <button onClick={() => handleDelete(m.id)} className="cs-btn cs-btn--danger cs-btn--sm flex-1">Elimina</button>
                  </>
                ) : (
                  <span className="text-secondary text-sm">—</span>
                )}
              </div>
            </div>
          ))}
          {messages.length === 0 && (
            <div className="px-6 py-8 text-center">
              <div className="text-secondary mb-4"><span className="text-4xl">✉️</span></div>
              <h3 className="text-lg font-semibold mb-2">Nessun messaggio</h3>
              <p className="text-secondary mb-4">Crea un messaggio per le tue squadre.</p>
            </div>
          )}
        </div>
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
        <DetailsDrawer open={true} title="Dettaglio Messaggio" onClose={() => setSelectedMessage(null)}>
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs text-gray-500">Oggetto</div>
              <div className="font-medium">{selectedMessage.subject}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Data</div>
              <div>{new Date(selectedMessage.created_at || '').toLocaleString('it-IT')}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Contenuto</div>
              <div className="whitespace-pre-wrap">{selectedMessage.content}</div>
            </div>
            {selectedMessage.created_by_profile && (
              <div>
                <div className="text-xs text-gray-500">Mittente</div>
                <div>{selectedMessage.created_by_profile.first_name} {selectedMessage.created_by_profile.last_name}</div>
              </div>
            )}
            {(selectedMessage as any).attachments && (selectedMessage as any).attachments.length > 0 && (
              <div>
                <div className="text-xs text-gray-500">Allegati</div>
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
                <div className="text-xs text-gray-500 mb-1">Destinatari</div>
                <div className="flex flex-wrap gap-1">
                  {selectedMessage.message_recipients.map((mr) => (
                    <span key={mr.id} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
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
