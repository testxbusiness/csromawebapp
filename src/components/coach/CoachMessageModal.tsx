'use client'

import * as React from 'react'
import { toast } from '@/components/ui'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/Dialog'

type Team = { id: string; name: string; code: string }
type Message =
  | {
      id: string
      subject: string
      content: string
      attachment_url?: string
      message_recipients?: { teams?: { id: string } }[]
    }
  | null

export default function CoachMessageModal({
  open,
  onClose,
  message,
  teams,
  onSubmit,
  loading = false,
}: {
  open: boolean
  onClose: () => void
  message: Message
  teams: Team[]
  loading?: boolean
  onSubmit: (data: {
    subject: string
    content: string
    attachment_url?: string
    selected_teams: string[]
  }) => void
}) {
  const [formData, setFormData] = React.useState({
    subject: message?.subject || '',
    content: message?.content || '',
    attachment_url: message?.attachment_url || '',
    selected_teams:
      message?.message_recipients
        ?.filter((mr) => mr.teams)
        .map((mr) => mr.teams!.id) || [],
  })
  const [files, setFiles] = React.useState<{ file_path: string; file_name: string; mime_type?: string; file_size?: number }[]>([])
  const [uploading, setUploading] = React.useState(false)

  React.useEffect(() => {
    setFormData({
      subject: message?.subject || '',
      content: message?.content || '',
      attachment_url: message?.attachment_url || '',
      selected_teams:
        message?.message_recipients
          ?.filter((mr) => mr.teams)
          .map((mr) => mr.teams!.id) || [],
    })
  }, [message, open])

  const toggleTeam = (teamId: string) => {
    setFormData((prev) => ({
      ...prev,
      selected_teams: prev.selected_teams.includes(teamId)
        ? prev.selected_teams.filter((id) => id !== teamId)
        : [...prev.selected_teams, teamId],
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ ...formData, selected_teams: formData.selected_teams, attachment_url: formData.attachment_url || undefined, attachments: files } as any)
  }

  const handleFileChange = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files
    if (!f || f.length === 0) return
    const fd = new FormData()
    Array.from(f).forEach(file => fd.append('files', file))
    if (message?.id) fd.append('message_id', message.id)
    setUploading(true)
    try {
      const res = await fetch('/api/messages/attachments/upload', { method: 'POST', body: fd })
      const result = await res.json()
      if (!res.ok) {
        toast.error(result.error || 'Errore upload allegati')
        return
      }
      setFiles(prev => [...prev, ...result.files])
      ev.target.value = ''
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="cs-modal--centered cs-modal--md">
        <DialogHeader>
          <DialogTitle>{message ? 'Modifica Messaggio' : 'Nuovo Messaggio'}</DialogTitle>
          <DialogDescription>
            Compila i campi e seleziona le squadre destinatarie.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="cs-grid" style={{ gap: 12 }}>
            <div className="cs-field">
              <label className="cs-field__label">Oggetto *</label>
              <input
                type="text"
                required
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="cs-input"
                placeholder="Oggetto del messaggio"
              />
            </div>

            <div className="cs-field">
              <label className="cs-field__label">Contenuto *</label>
              <textarea
                rows={6}
                required
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="cs-textarea"
                placeholder="Scrivi il contenuto del messaggio..."
              />
            </div>

          <div className="cs-field">
            <label className="cs-field__label">Allegati</label>
            <div className="flex items-center gap-3">
              <input type="file" multiple onChange={handleFileChange} />
              {uploading && <span className="text-xs text-secondary">Caricamento…</span>}
            </div>
            {files.length > 0 && (
              <div className="mt-2 space-y-1 text-sm">
                {files.map((f, idx) => (
                  <div key={`${f.file_path}-${idx}`} className="flex items-center justify-between">
                    <span className="truncate">{f.file_name}</span>
                    <button type="button" className="cs-btn cs-btn--ghost cs-btn--sm" onClick={() => setFiles(prev => prev.filter((x, i) => i !== idx))}>Rimuovi</button>
                  </div>
                ))}
              </div>
            )}
          </div>

            <div className="cs-field">
              <label className="cs-field__label">Destinatari Squadre</label>
              <div className="space-y-2 max-h-44 overflow-y-auto">
                {teams.map((team) => (
                  <label key={team.id} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.selected_teams.includes(team.id)}
                      onChange={() => toggleTeam(team.id)}
                      className="h-4 w-4"
                    />
                    <span className="ml-2 text-sm">
                      {team.name} ({team.code})
                    </span>
                  </label>
                ))}
                {teams.length === 0 && (
                  <p className="text-xs text-secondary">Nessuna squadra disponibile</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <button type="button" className="cs-btn cs-btn--ghost">Annulla</button>
            </DialogClose>
            <button type="submit" disabled={loading} className="cs-btn cs-btn--primary">
              {message ? 'Aggiorna' : 'Crea'} Messaggio
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
