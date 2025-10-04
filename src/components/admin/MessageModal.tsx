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

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      {/* centrato e coerente con il DS */}
      <DialogContent className="cs-modal--centered cs-modal--md">
        <DialogHeader>
          <DialogTitle>{message ? 'Modifica Messaggio' : 'Nuovo Messaggio'}</DialogTitle>
        </DialogHeader>

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

          <div>
            <label className="cs-field__label">URL Allegato (opzionale)</label>
            <input
              className="cs-input"
              type="url"
              value={form.attachment_url ?? ''}
              onChange={(e) => setForm({ ...form, attachment_url: e.target.value })}
              placeholder="https://…/documento.pdf"
            />
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
