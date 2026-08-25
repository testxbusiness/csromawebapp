'use client'

import { useState } from 'react'
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, toast } from '@/components/ui'

type Account = { status: string; roles: string[] } | null

export default function FamilyMemberAccountActions({
  id,
  name,
  email,
  account,
  onChanged,
}: {
  id: string
  name: string
  email: string | null
  account: Account
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [accountEmail, setAccountEmail] = useState(email || '')
  const [saving, setSaving] = useState(false)

  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/profiles/${id}/create-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: accountEmail, role: 'family_member' }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Impossibile creare l’account')
      toast.success('Account familiare creato. Ora puoi inviare l’invito.')
      setOpen(false)
      onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossibile creare l’account')
    } finally {
      setSaving(false)
    }
  }

  const invite = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/profiles/${id}/invite-account`, { method: 'POST' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Impossibile inviare l’invito')
      toast.success('Invito inviato')
      onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossibile inviare l’invito')
    } finally {
      setSaving(false)
    }
  }

  if (account?.status === 'invited') {
    return <Button type="button" variant="outline" size="sm" onClick={() => void invite()} disabled={saving}>{saving ? 'Invio…' : 'Invia invito'}</Button>
  }

  if (account) return <span className="text-xs text-[color:var(--cs-text-tertiary)]">Gestito dalla sezione Utenti</span>

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => { setAccountEmail(email || ''); setOpen(true) }}>
        Crea account familiare
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="cs-modal--centered cs-modal--md">
          <DialogHeader>
            <DialogTitle>Crea account familiare</DialogTitle>
            <DialogDescription>
              Collega un account familiare/tutore a {name}. L’accesso ai minori dipenderà esclusivamente dalle relazioni attive e dai permessi concessi.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={create} className="space-y-4">
            <div>
              <label htmlFor={`family-account-email-${id}`} className="cs-field__label">Email account *</label>
              <input id={`family-account-email-${id}`} type="email" required className="cs-input" value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annulla</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Creazione…' : 'Crea account'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
