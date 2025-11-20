'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'

type Message = {
  id?: string
  subject: string
  content: string
  attachment_url?: string
  attachments?: { file_path: string; file_name: string; mime_type?: string; file_size?: number }[]
  // NB: il backend del tuo form inline usa questi campi
  selected_teams?: string[]
  selected_users?: string[]
}

type Team = { id: string; name: string; code: string }
type User = { id: string; first_name: string; last_name: string; role: string }

type Props = {
  open: boolean
  onClose: () => void
  message: Message | null
  teams: Team[]
  users: User[]
  onCreate: (data: Omit<Message, 'id'>) => Promise<void> | void
  onUpdate: (id: string, data: Partial<Message>) => Promise<void> | void
}

export default function MessageModal({
  open,
  onClose,
  message,
  teams,
  users,
  onCreate,
  onUpdate,
}: Props) {
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState<Message>({
    subject: message?.subject ?? '',
    content: message?.content ?? '',
    attachment_url: message?.attachment_url ?? '',
    selected_teams: message?.selected_teams ??
      (message?.['message_recipients'] as any)?.filter((mr: any) => mr.teams).map((mr: any) => mr.teams.id) ?? [],
    selected_users: message?.selected_users ??
      (message?.['message_recipients'] as any)?.filter((mr: any) => mr.profiles).map((mr: any) => mr.profiles.id) ?? [],
  })
  const [uploading, setUploading] = React.useState(false)
  const [files, setFiles] = React.useState<{ file_path: string; file_name: string; mime_type?: string; file_size?: number }[]>([])

  React.useEffect(() => {
    setForm({
      subject: message?.subject ?? '',
      content: message?.content ?? '',
      attachment_url: message?.attachment_url ?? '',
      selected_teams: message?.['message_recipients']
        ? (message as any).message_recipients.filter((mr: any) => mr.teams).map((mr: any) => mr.teams.id)
        : [],
      selected_users: message?.['message_recipients']
        ? (message as any).message_recipients.filter((mr: any) => mr.profiles).map((mr: any) => mr.profiles.id)
        : [],
    })
    // Preload attachments if present on message
    const atts = (message as any)?.attachments as any[] | undefined
    setFiles(Array.isArray(atts) ? atts.map(a => ({ file_path: a.file_path || '', file_name: a.file_name, mime_type: a.mime_type, file_size: a.file_size })) : [])
  }, [message])

  const toggle = (list: 'selected_teams' | 'selected_users', id: string) => {
    setForm((prev) => ({
      ...prev,
      [list]: prev[list]?.includes(id)
        ? prev[list]!.filter((x) => x !== id)
        : [...(prev[list] ?? []), id],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload: Omit<Message, 'id'> = {
        subject: form.subject.trim(),
        content: form.content.trim(),
        attachment_url: form.attachment_url?.trim() || undefined,
        attachments: files,
        selected_teams: form.selected_teams ?? [],
        selected_users: form.selected_users ?? [],
      }
      if (message?.id) await onUpdate(message.id, payload)
      else await onCreate(payload)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleFileChange = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files
    if (!f || f.length === 0) return
    const formData = new FormData()
    Array.from(f).forEach(file => formData.append('files', file))
    if (message?.id) formData.append('message_id', message.id)
    setUploading(true)
    try {
      const res = await fetch('/api/messages/attachments/upload', { method: 'POST', body: formData })
      const result = await res.json()
      if (!res.ok) {
        toast.error(result.error || 'Errore upload allegati')
        return
      }
      const uploaded = result.files as any[]
      setFiles(prev => [...prev, ...uploaded])
      // reset input
      ev.target.value = ''
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      {/* centrato e coerente con il DS */}
      <DialogContent className="cs-modal--centered cs-modal--md">
        <DialogHeader className="sr-only">
          <DialogTitle>{message ? 'Modifica Messaggio' : 'Nuovo Messaggio'}</DialogTitle>
        </DialogHeader>
        <div className="cs-modal__header" style={{ alignItems: 'center', gap: 12 }}>
          <div className="cs-modal__icon" aria-hidden>✉️</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="cs-modal__title">{message ? 'Modifica Messaggio' : 'Nuovo Messaggio'}</h2>
            <div className="text-secondary" style={{ fontSize: 12, marginTop: 4 }}>Compila i campi e seleziona i destinatari</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="cs-field__label">Oggetto *</label>
            <input
              className="cs-input"
              type="text"
              required
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Oggetto del messaggio"
            />
          </div>

          <div>
            <label className="cs-field__label">Contenuto *</label>
            <textarea
              className="cs-textarea"
              rows={6}
              required
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Scrivi qui il messaggio…"
            />
          </div>

          <div className="cs-card p-4">
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

          <div className="cs-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label className="cs-field__label">Destinatari Squadre</label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {teams.length === 0 && <p className="text-xs text-secondary">Nessuna squadra disponibile</p>}
                {teams.map((t) => (
                  <label key={t.id} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={!!form.selected_teams?.includes(t.id)}
                      onChange={() => toggle('selected_teams', t.id)}
                    />
                    <span className="ml-2 text-sm">{t.name} ({t.code})</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="cs-field__label">Destinatari Utenti</label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {users.length === 0 && <p className="text-xs text-secondary">Nessun utente disponibile</p>}
                {users.map((u) => (
                  <label key={u.id} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={!!form.selected_users?.includes(u.id)}
                      onChange={() => toggle('selected_users', u.id)}
                    />
                    <span className="ml-2 text-sm">
                      {u.first_name} {u.last_name} ({u.role})
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="cs-modal__footer">
            <button type="button" className="cs-btn cs-btn--ghost" onClick={onClose}>Annulla</button>
            <button type="submit" className="cs-btn cs-btn--primary" disabled={saving}>
              {saving ? 'Invio…' : message ? 'Aggiorna' : 'Invia'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
