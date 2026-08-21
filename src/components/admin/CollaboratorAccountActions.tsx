'use client'

import { useState } from 'react'
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, toast } from '@/components/ui'

interface Props { id: string; name: string; email: string | null; account: { status: string; roles: string[] } | null; role: 'coach' | 'staff' | 'admin' | 'athlete'; onChanged: () => void }

export default function CollaboratorAccountActions({ id, name, email, account, role, onChanged }: Props) {
  const [open, setOpen] = useState(false)
  const [accountEmail, setAccountEmail] = useState(email || '')
  const [saving, setSaving] = useState(false)
  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true)
    try {
      const response = await fetch(`/api/admin/profiles/${id}/create-account`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: accountEmail, role }) })
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Impossibile creare l’account')
      toast.success('Account creato. L’invito può essere inviato ora.'); setOpen(false); onChanged()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Impossibile creare l’account') } finally { setSaving(false) }
  }
  const invite = async () => {
    setSaving(true)
    try { const response = await fetch(`/api/admin/profiles/${id}/invite-account`, { method: 'POST' }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Impossibile inviare l’invito'); toast.success('Invito inviato'); onChanged() }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Impossibile inviare l’invito') } finally { setSaving(false) }
  }
  if (account?.status === 'invited') return <Button type="button" variant="outline" size="sm" onClick={() => void invite()} disabled={saving}>{saving ? 'Invio…' : 'Invia invito'}</Button>
  if (account?.status === 'disabled') return <span className="text-xs text-[color:var(--cs-text-tertiary)]">Account non attivo</span>
  if (account?.status === 'suspended') return <span className="text-xs text-[color:var(--cs-text-tertiary)]">Account sospeso</span>
  if (account) return <span className="text-xs text-[color:var(--cs-text-tertiary)]">Account attivo</span>
  return <>
    <Button type="button" variant="outline" size="sm" onClick={() => { setAccountEmail(email || ''); setOpen(true) }}>Crea account</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="cs-modal--centered cs-modal--md"><DialogHeader><DialogTitle>Crea account</DialogTitle><DialogDescription>Collega un account {role} a {name}. Non viene inviata alcuna email in questo passaggio.</DialogDescription></DialogHeader><form onSubmit={create} className="space-y-4"><div><label htmlFor={`account-email-${id}`} className="cs-field__label">Email account *</label><input id={`account-email-${id}`} type="email" required className="cs-input" value={accountEmail} onChange={(e) => setAccountEmail(e.target.value)} /></div><DialogFooter><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annulla</Button><Button type="submit" disabled={saving}>{saving ? 'Creazione…' : 'Crea account'}</Button></DialogFooter></form></DialogContent></Dialog>
  </>
}
