'use client'

import { useState, useEffect } from 'react'
import { toast } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'
import { exportToExcel } from '@/lib/utils/excelExport'
import MessageModal from '@/components/admin/MessageModal'
import MessageDetailModal from '@/components/shared/MessageDetailModal'

interface Message {
  id?: string
  subject: string
  content: string
  attachment_url?: string
  attachments?: { id: string; file_name: string; mime_type?: string; file_size?: number; download_url?: string | null }[]
  created_by?: string
  created_at?: string
  updated_at?: string
  
  // Joined data
  created_by_profile?: {
    first_name: string
    last_name: string
  }
  message_recipients?: {
    id: string
    is_read: boolean
    read_at?: string
    teams?: {
      id: string
      name: string
    }
    profiles?: {
      id: string
      first_name: string
      last_name: string
      email: string
    }
  }[]
}

interface Team {
  id: string
  name: string
  code: string
}

interface User {
  id: string
  first_name: string
  last_name: string
  email: string
  role: string
}

export default function MessagesManager() {
  const [messages, setMessages] = useState<Message[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [showModal, setShowModal] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadMessages()
    loadTeams()
    loadUsers()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadMessages = async () => {
    try {
      const response = await fetch('/api/admin/messages')
      const result = await response.json()

      if (!response.ok) {
        console.error('Errore caricamento messaggi:', result.error)
        setMessages([])
        setLoading(false)
        return
      }

      setMessages(result.messages || [])
      setLoading(false)
    } catch (error) {
      console.error('Errore caricamento messaggi:', error)
      setMessages([])
      setLoading(false)
    }
  }

  const loadTeams = async () => {
    const { data } = await supabase
      .from('teams')
      .select('id, name, code')
      .order('name')

    setTeams(data || [])
  }

  const loadUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, role')
      .order('first_name')

    setUsers(data || [])
  }

  const handleCreateMessage = async (messageData: Omit<Message, 'id'>) => {
    try {
      const response = await fetch('/api/admin/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData)
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('Errore creazione messaggio:', result.error)
        toast.error(`Errore: ${result.error}`)
        return
      }

      console.log('Messaggio creato con successo:', result.message)
      setShowModal(false)
      setEditingMessage(null)
      loadMessages()

    } catch (error) {
      console.error('Errore creazione messaggio:', error)
      toast.error('Errore di rete durante la creazione del messaggio')
    }
  }

  const handleUpdateMessage = async (id: string, messageData: Partial<Message>) => {
    try {
      const response = await fetch('/api/admin/messages', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          ...messageData
        })
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('Errore aggiornamento messaggio:', result.error)
        toast.error(`Errore: ${result.error}`)
        return
      }

      console.log('Messaggio aggiornato con successo:', result.message)
      setShowModal(false)
      setEditingMessage(null)
      loadMessages()

    } catch (error) {
      console.error('Errore aggiornamento messaggio:', error)
      toast.error('Errore di rete durante l\'aggiornamento del messaggio')
    }
  }

  const handleDeleteMessage = async (id: string) => {
    if (window.confirm('Sei sicuro di voler eliminare questo messaggio?')) {
      try {
        const response = await fetch(`/api/admin/messages?id=${id}`, {
          method: 'DELETE',
        })

        const result = await response.json()

        if (!response.ok) {
          console.error('Errore eliminazione messaggio:', result.error)
          toast.error(`Errore: ${result.error}`)
          return
        }

        console.log('Messaggio eliminato con successo:', result.message)
        loadMessages()

      } catch (error) {
        console.error('Errore eliminazione messaggio:', error)
        toast.error('Errore di rete durante l\'eliminazione del messaggio')
      }
    }
  }

  const exportMessagesToExcel = () => {
    exportToExcel(messages, [
      { key: 'subject', title: 'Oggetto', width: 25 },
      { key: 'content', title: 'Contenuto', width: 40 },
      { key: 'created_by_profile', title: 'Mittente', width: 20, format: (val) => val ? `${val.first_name} ${val.last_name}` : '' },
      { key: 'created_at', title: 'Data Invio', width: 15, format: (val) => new Date(val).toLocaleString('it-IT') },
      { key: 'message_recipients', title: 'Destinatari', width: 30, format: (val) => 
        val ? val.map((mr: any) => 
          mr.teams ? `Squadra: ${mr.teams.name}` : 
          mr.profiles ? `Utente: ${mr.profiles.first_name} ${mr.profiles.last_name}` : ''
        ).filter(Boolean).join(', ') : ''
      }
    ], {
      filename: 'messaggi_csroma',
      sheetName: 'Messaggi',
      headerStyle: { fill: { fgColor: { rgb: '3498DB' } } }
    })
  }

  if (loading) {
    return <div className="p-4">Caricamento messaggi...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Messaggi</h2>
        <div className="flex gap-3">
          <button onClick={exportMessagesToExcel} className="cs-btn cs-btn--outline">
            <span className="mr-2">📊</span>
            Export Excel
          </button>
          <button onClick={() => { setEditingMessage(null); setShowModal(true) }} className="cs-btn cs-btn--primary">
            Nuovo Messaggio
          </button>
        </div>
      </div>

      <MessageModal
  open={showModal}
  onClose={() => { setShowModal(false); setEditingMessage(null) }}
  message={editingMessage}
  teams={teams}
  users={users}
  onCreate={handleCreateMessage}
  onUpdate={handleUpdateMessage}
/>

      {selectedMessage && (
        <MessageDetailModal
          open={true}
          onClose={() => setSelectedMessage(null)}
          data={{
            subject: selectedMessage.subject,
            content: selectedMessage.content,
            created_at: selectedMessage.created_at || undefined,
            created_by_profile: selectedMessage.created_by_profile || null,
            message_recipients: (selectedMessage.message_recipients as any) || [],
            attachments: (selectedMessage.attachments as any)?.map((a:any)=>({ file_name: a.file_name, download_url: a.download_url })) || []
          }}
        />
      )}

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
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {messages.map((message) => (
              <tr key={message.id} className="cursor-pointer" onClick={() => setSelectedMessage(message)}>
                <td>
                  <div>
                    <div className="font-medium">{message.subject}</div>
                    <div className="text-secondary text-sm line-clamp-2">{message.content}</div>
                    {(message as any).attachments && (message as any).attachments.length > 0 && (
                      <div className="mt-1 text-xs text-secondary">Allegati: {(message as any).attachments.length}</div>
                    )}
                  </div>
                </td>
                <td>
                  <div>
                    {message.created_by_profile ? `${message.created_by_profile.first_name} ${message.created_by_profile.last_name}` : 'N/D'}
                  </div>
                </td>
                <td>
                  <div>
                    {message.created_at ? new Date(message.created_at).toLocaleDateString('it-IT') : 'N/D'}
                  </div>
                  <div className="text-xs text-secondary">
                    {message.created_at ? new Date(message.created_at).toLocaleTimeString('it-IT') : ''}
                  </div>
                </td>
                <td>
                  <div>
                    {message.message_recipients && message.message_recipients.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {message.message_recipients.map((mr) => (
                          <span key={mr.id} className="cs-badge cs-badge--neutral">
                            {mr.teams ? `🏀 ${mr.teams.name}` : `👤 ${mr.profiles?.first_name} ${mr.profiles?.last_name}`}
                          </span>
                        ))}
                      </div>
                    ) : (
                      'Nessun destinatario'
                    )}
                  </div>
                </td>
                <td className="cs-table__actions" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => { setEditingMessage(message); setShowModal(true) }} className="cs-btn cs-btn--outline cs-btn--sm">Modifica</button>
                  <button onClick={() => handleDeleteMessage(message.id!)} className="cs-btn cs-btn--danger cs-btn--sm">Elimina</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {/* Mobile cards */
        }
        <div className="md:hidden p-4 space-y-3">
          {messages.map((message) => (
            <div key={message.id} className="cs-card" onClick={() => setSelectedMessage(message)}>
              <div className="font-semibold">{message.subject}</div>
              <div className="text-sm text-secondary line-clamp-3">{message.content}</div>
              {(message as any).attachments && (message as any).attachments.length > 0 && (
                <div className="mt-1 text-xs text-secondary">Allegati: {(message as any).attachments.length}</div>
              )}
              <div className="mt-2 grid gap-2 text-sm">
                <div><strong>Mittente:</strong> {message.created_by_profile ? `${message.created_by_profile.first_name} ${message.created_by_profile.last_name}` : 'N/D'}</div>
                <div>
                  <strong>Data:</strong> {message.created_at ? new Date(message.created_at).toLocaleDateString('it-IT') : 'N/D'}
                  <span className="text-secondary ml-2">{message.created_at ? new Date(message.created_at).toLocaleTimeString('it-IT') : ''}</span>
                </div>
                <div>
                  <strong>Destinatari:</strong>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {message.message_recipients && message.message_recipients.length > 0 ? (
                      message.message_recipients.map((mr) => (
                        <span key={mr.id} className="cs-badge cs-badge--neutral">
                          {mr.teams ? `🏀 ${mr.teams.name}` : `👤 ${mr.profiles?.first_name} ${mr.profiles?.last_name}`}
                        </span>
                      ))
                    ) : (
                      <span className="text-secondary">Nessun destinatario</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => { setEditingMessage(message); setShowModal(true) }} className="cs-btn cs-btn--outline cs-btn--sm flex-1">Modifica</button>
                <button onClick={() => handleDeleteMessage(message.id!)} className="cs-btn cs-btn--danger cs-btn--sm flex-1">Elimina</button>
              </div>
            </div>
          ))}
        </div>

        {messages.length === 0 && (
          <div className="px-6 py-8 text-center">
            <div className="text-secondary mb-4"><span className="text-4xl">✉️</span></div>
            <h3 className="text-lg font-semibold mb-2">Nessun messaggio creato</h3>
            <p className="text-secondary mb-4">Crea il tuo primo messaggio per iniziare a comunicare con squadre e utenti.</p>
            <button onClick={() => { setEditingMessage(null); setShowModal(true) }} className="cs-btn cs-btn--primary">Crea il tuo primo messaggio</button>
          </div>
        )}
      </div>
    </div>
  )
}

function MessageForm({ 
  message, 
  teams,
  users,
  onSubmit, 
  onCancel 
}: { 
  message: Message | null
  teams: Team[]
  users: User[]
  onSubmit: (data: Omit<Message, 'id'>) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState({
    subject: message?.subject || '',
    content: message?.content || '',
    attachment_url: message?.attachment_url || '',
    selected_teams: message?.message_recipients?.filter(mr => mr.teams).map(mr => mr.teams!.id) || [],
    selected_users: message?.message_recipients?.filter(mr => mr.profiles).map(mr => mr.profiles!.id) || []
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const handleTeamSelection = (teamId: string) => {
    setFormData(prev => ({
      ...prev,
      selected_teams: prev.selected_teams.includes(teamId)
        ? prev.selected_teams.filter(id => id !== teamId)
        : [...prev.selected_teams, teamId]
    }))
  }

  const handleUserSelection = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      selected_users: prev.selected_users.includes(userId)
        ? prev.selected_users.filter(id => id !== userId)
        : [...prev.selected_users, userId]
    }))
  }

  return (
    <div className="cs-card p-6">
      <h3 className="text-lg font-semibold mb-4">
        {message ? 'Modifica Messaggio' : 'Nuovo Messaggio'}
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="cs-field__label">
            Oggetto *
          </label>
          <input
            type="text"
            required
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            className="cs-input"
            placeholder="Oggetto del messaggio"
          />
        </div>

        <div>
          <label className="cs-field__label">
            Contenuto *
          </label>
          <textarea
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            rows={6}
            required
            className="cs-textarea"
            placeholder="Scrivi il contenuto del messaggio..."
          />
        </div>

        <div>
          <label className="cs-field__label">
            URL Allegato (opzionale)
          </label>
          <input
            type="url"
            value={formData.attachment_url}
            onChange={(e) => setFormData({ ...formData, attachment_url: e.target.value })}
            className="cs-input"
            placeholder="https://example.com/document.pdf"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="cs-field__label">
              Destinatari Squadre
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {teams.map((team) => (
                <label key={team.id} className="flex items-center">
                  <input type="checkbox" checked={formData.selected_teams.includes(team.id)} onChange={() => handleTeamSelection(team.id)} className="h-4 w-4" />
                  <span className="ml-2 text-sm">
                    {team.name} ({team.code})
                  </span>
                </label>
              ))}
              {teams.length === 0 && (<p className="text-xs text-secondary">Nessuna squadra disponibile</p>)}
            </div>
          </div>

          <div>
            <label className="cs-field__label">
              Destinatari Utenti
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {users.map((user) => (
                <label key={user.id} className="flex items-center">
                  <input type="checkbox" checked={formData.selected_users.includes(user.id)} onChange={() => handleUserSelection(user.id)} className="h-4 w-4" />
                  <span className="ml-2 text-sm">
                    {user.first_name} {user.last_name} ({user.role})
                  </span>
                </label>
              ))}
              {users.length === 0 && (<p className="text-xs text-secondary">Nessun utente disponibile</p>)}
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button type="button" onClick={onCancel} className="cs-btn cs-btn--ghost">Annulla</button>
          <button type="submit" className="cs-btn cs-btn--primary">{message ? 'Aggiorna' : 'Crea'} Messaggio</button>
        </div>
      </form>
    </div>
  )
}
