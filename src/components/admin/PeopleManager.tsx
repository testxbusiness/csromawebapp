'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { UserPlus } from 'lucide-react'
import ProfileRelationshipsManager from './ProfileRelationshipsManager'
import FamilyMemberAccountActions from './FamilyMemberAccountActions'

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, EmptyState, ErrorState, LoadingState, toast } from '@/components/ui'

type Person = {
  id: string
  email: string | null
  first_name: string
  last_name: string
  phone: string | null
  birth_date: string | null
  role: string | null
  is_collaborator?: boolean
  account_email?: string | null
  is_active: boolean
  created_at: string
  relationships: Array<{
    id: string
    person_id: string
    person_name: string
    relationship_type: string
    status: string
    verified_at: string | null
    permissions: string[]
  }>
  account: {
    status: string
    roles: string[]
  } | null
}

type PersonForm = {
  first_name: string
  last_name: string
  email: string
  phone: string
  birth_date: string
}

const initialForm: PersonForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  birth_date: '',
}

function accountLabel(person: Person) {
  if (!person.account) return 'Senza account'
  if (person.account.status === 'active') return 'Account attivo'
  if (person.account.status === 'invited') return 'Invito in attesa'
  if (person.account.status === 'suspended') return 'Account sospeso'
  return 'Account disabilitato'
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('it-IT').format(new Date(`${value}T00:00:00`))
}

export default function PeopleManager() {
  const [people, setPeople] = useState<Person[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<PersonForm>(initialForm)

  const loadPeople = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/profiles')
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Impossibile caricare le persone')
      setPeople(result.profiles || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossibile caricare le persone'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPeople()
  }, [loadPeople])

  const filteredPeople = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return people
    return people.filter((person) =>
      [person.first_name, person.last_name, person.email, person.phone]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query))
    )
  }, [people, search])

  const updateField = (field: keyof PersonForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const closeDialog = () => {
    if (saving) return
    setDialogOpen(false)
    setForm(initialForm)
  }

  const createPerson = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    try {
      const response = await fetch('/api/admin/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email || null,
          phone: form.phone || null,
          birth_date: form.birth_date || null,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Impossibile creare la persona')

      toast.success('Persona creata senza account Auth')
      closeDialog()
      await loadPeople()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Impossibile creare la persona')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-5" aria-labelledby="people-section-title">
      <div className="cs-card cs-card--primary p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="people-section-title" className="text-lg font-semibold text-[color:var(--cs-text)]">Anagrafica persone</h2>
            <p className="mt-1 max-w-2xl text-sm text-[color:var(--cs-text-secondary)]">
            Consulta l’anagrafica delle persone. Gli account atleta, coach e staff vengono creati nelle sezioni dedicate; da qui puoi creare un account familiare/tutore.
            </p>
          </div>
          <Button type="button" onClick={() => setDialogOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
            Nuova persona
          </Button>
        </div>

        <div className="mt-5 max-w-xl">
          <label htmlFor="people-search" className="cs-field__label">Cerca persona</label>
          <input
            id="people-search"
            type="search"
            className="cs-input"
            placeholder="Nome, cognome, email o telefono"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {loading ? <LoadingState label="Caricamento persone…" /> : null}

      {!loading && error ? (
        <ErrorState
          title="Impossibile caricare le persone"
          description={error}
          action={<Button variant="outline" onClick={loadPeople}>Riprova</Button>}
        />
      ) : null}

      {!loading && !error && filteredPeople.length === 0 ? (
        <EmptyState
          title={people.length === 0 ? 'Nessuna persona presente' : 'Nessun risultato'}
          description={people.length === 0 ? 'La prima persona può essere creata senza account Auth.' : 'Prova a modificare i criteri di ricerca.'}
          action={people.length === 0 ? <Button onClick={() => setDialogOpen(true)}>Crea la prima persona</Button> : undefined}
        />
      ) : null}

      {!loading && !error && filteredPeople.length > 0 ? (
        <div className="cs-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <caption className="sr-only">Elenco persone</caption>
              <thead className="border-b border-[color:var(--cs-border)] bg-[color:var(--cs-surface-muted)] text-[color:var(--cs-text-secondary)]">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Persona</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Contatti</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Data di nascita</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Accesso</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Stato</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Relazioni</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--cs-border)]">
                {filteredPeople.map((person) => (
                  <tr key={person.id} className="align-top hover:bg-[color:var(--cs-surface-muted)]/60">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-[color:var(--cs-text)]">{person.first_name} {person.last_name}</div>
                      <div className="mt-1 text-xs text-[color:var(--cs-text-tertiary)]">Creata il {formatDate(person.created_at.slice(0, 10))}</div>
                    </td>
                    <td className="px-4 py-4 text-[color:var(--cs-text-secondary)]">
                      <div>{person.email || person.account_email || 'Email non indicata'}</div>
                      <div className="mt-1 text-xs">{person.phone || 'Telefono non indicato'}</div>
                    </td>
                    <td className="px-4 py-4 text-[color:var(--cs-text-secondary)]">{formatDate(person.birth_date)}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${person.account ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                        {accountLabel(person)}
                      </span>
                      {person.account?.roles.length ? (
                        <div className="mt-1 text-xs text-[color:var(--cs-text-tertiary)]">{person.account.roles.join(', ')}</div>
                      ) : person.role ? (
                        <div className="mt-1 text-xs text-[color:var(--cs-text-tertiary)]">{person.role}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 text-[color:var(--cs-text-secondary)]">{person.is_active ? 'Attiva' : 'Archiviata'}</td>
                    <td className="px-4 py-4 text-[color:var(--cs-text-secondary)]">
                      {person.relationships.length === 0 ? (
                        <span className="text-xs text-[color:var(--cs-text-tertiary)]">Nessuna</span>
                      ) : (
                        <div className="space-y-1">
                          <div className="font-medium">{person.relationships.length} collegat{person.relationships.length === 1 ? 'a' : 'e'}</div>
                          {person.relationships.slice(0, 2).map((relationship) => (
                            <div key={relationship.id} className="text-xs">
                              {relationship.person_name} · {relationship.status === 'active' ? 'Attiva' : relationship.status === 'pending' ? 'In revisione' : 'Revocata'}
                            </div>
                          ))}
                          {person.relationships.length > 2 ? <div className="text-xs text-[color:var(--cs-text-tertiary)]">+{person.relationships.length - 2} altre</div> : null}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-xs text-[color:var(--cs-text-tertiary)]">
                        <div className="flex flex-col items-end gap-2">
                          <ProfileRelationshipsManager person={person} people={people} />
                          {!person.account && !person.role && !person.is_collaborator ? <FamilyMemberAccountActions id={person.id} name={`${person.first_name} ${person.last_name}`} email={person.email} account={person.account} onChanged={() => void loadPeople()} /> : null}
                        </div>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-[color:var(--cs-border)] px-4 py-3 text-xs text-[color:var(--cs-text-tertiary)]">
            {filteredPeople.length} di {people.length} persone visualizzate
          </div>
        </div>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="cs-modal--centered cs-modal--md">
          <DialogHeader>
            <DialogTitle>Nuova persona</DialogTitle>
            <DialogDescription>
              Inserisci solo i dati anagrafici. L’account Auth potrà essere creato in un passaggio successivo.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={createPerson} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="person-first-name" className="cs-field__label">Nome *</label>
                <input id="person-first-name" className="cs-input" required maxLength={100} value={form.first_name} onChange={(event) => updateField('first_name', event.target.value)} autoComplete="given-name" />
              </div>
              <div>
                <label htmlFor="person-last-name" className="cs-field__label">Cognome *</label>
                <input id="person-last-name" className="cs-input" required maxLength={100} value={form.last_name} onChange={(event) => updateField('last_name', event.target.value)} autoComplete="family-name" />
              </div>
            </div>
            <div>
              <label htmlFor="person-email" className="cs-field__label">Email <span className="font-normal text-[color:var(--cs-text-tertiary)]">(opzionale)</span></label>
              <input id="person-email" type="email" className="cs-input" maxLength={320} value={form.email} onChange={(event) => updateField('email', event.target.value)} autoComplete="email" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="person-phone" className="cs-field__label">Telefono <span className="font-normal text-[color:var(--cs-text-tertiary)]">(opzionale)</span></label>
                <input id="person-phone" type="tel" className="cs-input" maxLength={40} value={form.phone} onChange={(event) => updateField('phone', event.target.value)} autoComplete="tel" />
              </div>
              <div>
                <label htmlFor="person-birth-date" className="cs-field__label">Data di nascita <span className="font-normal text-[color:var(--cs-text-tertiary)]">(opzionale)</span></label>
                <input id="person-birth-date" type="date" className="cs-input" value={form.birth_date} onChange={(event) => updateField('birth_date', event.target.value)} autoComplete="bday" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={closeDialog} disabled={saving}>Annulla</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Salvataggio…' : 'Crea persona'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </section>
  )
}
