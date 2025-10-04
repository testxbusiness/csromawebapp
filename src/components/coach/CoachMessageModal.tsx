'use client'

import * as React from 'react'
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
    onSubmit(formData)
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
              <label className="cs-field__label">URL Allegato (opzionale)</label>
              <input
                type="url"
                value={formData.attachment_url}
                onChange={(e) => setFormData({ ...formData, attachment_url: e.target.value })}
                className="cs-input"
                placeholder="https://example.com/document.pdf"
              />
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
