'use client'

import { useEffect, useMemo, useState } from 'react'
import { Link2, Plus, ShieldCheck, XCircle } from 'lucide-react'
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, toast } from '@/components/ui'

type PersonOption = {
  id: string
  first_name: string
  last_name: string
}

type Relationship = {
  id: string
  source_profile_id: string
  target_profile_id: string
  relationship_type: string
  status: string
  valid_from: string
  valid_until: string | null
  can_view_schedule: boolean
  can_confirm_attendance: boolean
  can_view_payments: boolean
  can_view_medical_status: boolean
  can_view_documents: boolean
  can_sign_documents: boolean
  can_receive_messages: boolean
  verified_at: string | null
}

type Props = {
  person: PersonOption
  people: PersonOption[]
}

const relationshipLabels: Record<string, string> = {
  parent: 'Genitore',
  guardian: 'Tutore',
  caregiver: 'Caregiver',
  dependent: 'Persona a carico',
  delegate: 'Delegato',
}

const initialPermissions = {
  can_view_schedule: true,
  can_confirm_attendance: false,
  can_view_payments: false,
  can_view_medical_status: false,
  can_view_documents: false,
  can_sign_documents: false,
  can_receive_messages: true,
}

function personName(people: PersonOption[], id: string) {
  const person = people.find((entry) => entry.id === id)
  return person ? `${person.first_name} ${person.last_name}` : 'Persona non trovata'
}

export default function ProfileRelationshipsManager({ person, people }: Props) {
  const [open, setOpen] = useState(false)
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sourceProfileId, setSourceProfileId] = useState(person.id)
  const [targetProfileId, setTargetProfileId] = useState('')
  const [relationshipType, setRelationshipType] = useState('parent')
  const [status, setStatus] = useState('active')
  const [verified, setVerified] = useState(false)
  const [permissions, setPermissions] = useState(initialPermissions)

  const otherPeople = useMemo(() => people.filter((entry) => entry.id !== sourceProfileId), [people, sourceProfileId])

  useEffect(() => {
    if (!targetProfileId && otherPeople[0]) setTargetProfileId(otherPeople[0].id)
    if (targetProfileId && !otherPeople.some((entry) => entry.id === targetProfileId)) setTargetProfileId(otherPeople[0]?.id ?? '')
  }, [otherPeople, targetProfileId])

  const loadRelationships = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/profiles/${person.id}/relationships`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Impossibile caricare le relazioni')
      setRelationships(payload.relationships ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossibile caricare le relazioni')
    } finally {
      setLoading(false)
    }
  }

  const openDialog = () => {
    setOpen(true)
    loadRelationships().catch(() => {})
  }

  const createRelationship = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!sourceProfileId || !targetProfileId || sourceProfileId === targetProfileId) {
      toast.error('Seleziona due persone diverse')
      return
    }
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/profiles/${person.id}/relationships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_profile_id: sourceProfileId,
          target_profile_id: targetProfileId,
          relationship_type: relationshipType,
          status,
          verified,
          ...permissions,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Impossibile creare la relazione')
      toast.success('Relazione creata')
      setRelationships((current) => [payload.relationship, ...current])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossibile creare la relazione')
    } finally {
      setSaving(false)
    }
  }

  const revokeRelationship = async (relationshipId: string) => {
    try {
      const response = await fetch(`/api/admin/relationships/${relationshipId}`, { method: 'DELETE' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Impossibile revocare la relazione')
      setRelationships((current) => current.map((entry) => entry.id === relationshipId ? payload.relationship : entry))
      toast.success('Relazione revocata')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossibile revocare la relazione')
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={openDialog} aria-label={`Gestisci relazioni di ${person.first_name} ${person.last_name}`}>
        <Link2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
        Relazioni
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="cs-modal--centered cs-modal--lg">
          <DialogHeader>
            <DialogTitle>Relazioni di {person.first_name} {person.last_name}</DialogTitle>
            <DialogDescription>
              Collega persone con permessi specifici. La selezione del profilo accessibile non sostituisce mai i controlli server-side.
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[65vh] flex-col gap-5 overflow-y-auto pr-1">
            <form onSubmit={createRelationship} className="order-2 space-y-4 rounded-xl border border-[color:var(--cs-border)] bg-[color:var(--cs-surface-muted)] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--cs-text)]">
                <Plus className="h-4 w-4" aria-hidden="true" /> Nuova relazione
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor={`relationship-source-${person.id}`} className="cs-field__label">Persona che accede *</label>
                  <select id={`relationship-source-${person.id}`} className="cs-select" value={sourceProfileId} onChange={(event) => setSourceProfileId(event.target.value)}>
                    {people.map((entry) => <option key={entry.id} value={entry.id}>{entry.first_name} {entry.last_name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor={`relationship-target-${person.id}`} className="cs-field__label">Profilo accessibile *</label>
                  <select id={`relationship-target-${person.id}`} className="cs-select" value={targetProfileId} onChange={(event) => setTargetProfileId(event.target.value)}>
                    {otherPeople.map((entry) => <option key={entry.id} value={entry.id}>{entry.first_name} {entry.last_name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor={`relationship-type-${person.id}`} className="cs-field__label">Tipo relazione *</label>
                  <select id={`relationship-type-${person.id}`} className="cs-select" value={relationshipType} onChange={(event) => setRelationshipType(event.target.value)}>
                    {Object.entries(relationshipLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor={`relationship-status-${person.id}`} className="cs-field__label">Stato *</label>
                  <select id={`relationship-status-${person.id}`} className="cs-select" value={status} onChange={(event) => setStatus(event.target.value)}>
                    <option value="pending">In revisione</option>
                    <option value="active">Attiva</option>
                  </select>
                </div>
              </div>

              <fieldset className="space-y-2">
                <legend className="cs-field__label">Permessi concessi</legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {([
                    ['can_view_schedule', 'Vedere calendario'],
                    ['can_confirm_attendance', 'Confermare presenze'],
                    ['can_view_payments', 'Vedere pagamenti'],
                    ['can_view_medical_status', 'Vedere certificato medico'],
                    ['can_view_documents', 'Vedere documenti'],
                    ['can_sign_documents', 'Firmare documenti'],
                    ['can_receive_messages', 'Ricevere messaggi'],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex min-h-11 items-center gap-2 text-sm text-[color:var(--cs-text-secondary)]">
                      <input type="checkbox" checked={permissions[key]} onChange={(event) => setPermissions((current) => ({ ...current, [key]: event.target.checked }))} />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="flex min-h-11 items-center gap-2 text-sm text-[color:var(--cs-text-secondary)]">
                <input type="checkbox" checked={verified} onChange={(event) => setVerified(event.target.checked)} />
                <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Relazione verificata dall’amministrazione
              </label>
              <DialogFooter>
                <Button type="submit" disabled={saving || !targetProfileId}>{saving ? 'Salvataggio…' : 'Crea relazione'}</Button>
              </DialogFooter>
            </form>

            <section aria-labelledby={`relationship-list-${person.id}`} className="order-1">
              <h3 id={`relationship-list-${person.id}`} className="mb-3 text-sm font-semibold text-[color:var(--cs-text)]">Relazioni esistenti ({relationships.length})</h3>
              {loading ? <p className="text-sm text-[color:var(--cs-text-secondary)]">Caricamento…</p> : null}
              {!loading && relationships.length === 0 ? <p className="text-sm text-[color:var(--cs-text-secondary)]">Nessuna relazione registrata.</p> : null}
              <div className="space-y-2">
                {relationships.map((relationship) => (
                  <div key={relationship.id} className="flex flex-col gap-3 rounded-xl border border-[color:var(--cs-border)] p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold text-[color:var(--cs-text)]">
                        {personName(people, relationship.source_profile_id)} → {personName(people, relationship.target_profile_id)}
                      </p>
                      <p className="text-[color:var(--cs-text-secondary)]">
                        {relationshipLabels[relationship.relationship_type] || relationship.relationship_type} · {relationship.status === 'active' ? 'Attiva' : relationship.status === 'pending' ? 'In revisione' : 'Revocata'}
                        {relationship.verified_at ? ' · Verificata' : ''}
                      </p>
                    </div>
                    {relationship.status === 'active' ? (
                      <Button type="button" variant="danger" size="sm" onClick={() => revokeRelationship(relationship.id)}>
                        <XCircle className="mr-1.5 h-4 w-4" aria-hidden="true" /> Revoca
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
