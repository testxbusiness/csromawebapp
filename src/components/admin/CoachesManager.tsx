'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { EmptyState, LoadingState, toast } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'
import type { Coach, Team, Activity, Season } from './coachTypes'
import BulkOperationsModal from './BulkOperationsModal'
import TeamAssignmentModal from './TeamAssignmentModal'
import CollaboratorModal, { type CollaboratorFormData } from './CollaboratorModal'
import CollaboratorAccountActions from './CollaboratorAccountActions'
import DetailsDrawer from '@/components/shared/DetailsDrawer'

interface CoachWithDetails extends Coach {
  collaborator_type: 'coach' | 'staff' | 'admin'
  season_ids: string[]
  account: { status: string; roles: string[] } | null
  teams: Array<{
    id: string
    name: string
    role: string
    assigned_at: string
    activity_id?: string
  }>
}

export default function CoachesManager() {
  const [coaches, setCoaches] = useState<CoachWithDetails[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCoaches, setSelectedCoaches] = useState<Set<string>>(new Set())
  const [bulkOperation, setBulkOperation] = useState<string | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [showTeamAssignmentModal, setShowTeamAssignmentModal] = useState(false)
  const [showCollaboratorModal, setShowCollaboratorModal] = useState(false)
  const [editingCollaborator, setEditingCollaborator] = useState<CollaboratorFormData | null>(null)
  const [editingCollaboratorId, setEditingCollaboratorId] = useState<string | null>(null)
  const [collaboratorSubmitting, setCollaboratorSubmitting] = useState(false)
  const [detailsCollaborator, setDetailsCollaborator] = useState<CoachWithDetails | null>(null)

  const supabase = createClient()

  // Filtri di contesto
  const [selectedSeason, setSelectedSeason] = useState<string>('all')
  const [selectedActivity, setSelectedActivity] = useState<string>('all')
  const [selectedTeam, setSelectedTeam] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  const loadCoaches = useCallback(async () => {
    try {
      // Carica coach con dettagli completi
      const response = await fetch('/api/admin/collaborators')
      const result = await response.json()

      if (!response.ok) {
        console.error('Errore caricamento collaboratori:', result.error)
        setCoaches([])
        return
      }

      setCoaches(result.collaborators || [])
    } catch (error) {
      console.error('Errore caricamento collaboratori:', error)
      setCoaches([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadContextData = useCallback(async () => {
    try {
      // Carica stagioni
      const { data: seasonsData } = await supabase
        .from('seasons')
        .select('id, name, start_date, end_date, is_active')
        .order('created_at', { ascending: false })

      // Carica attività
      const { data: activitiesData } = await supabase
        .from('activities')
        .select('id, name, season_id')
        .order('name')

      // Carica squadre
      const { data: teamsData } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          code,
          activity_id
        `)
        .order('name')

      setSeasons(seasonsData || [])
      setActivities(activitiesData || [])
      setTeams(teamsData || [])
    } catch (error) {
      console.error('Errore caricamento dati contesto:', error)
    }
  }, [supabase])

  useEffect(() => {
    loadCoaches()
    loadContextData()
  }, [loadCoaches, loadContextData])

  // Filtra coach in base al contesto
  const filteredCoaches = useMemo(() => {
    return coaches.filter(coach => {
      // Filtro stagione
      if (selectedSeason !== 'all') {
        if (!coach.season_ids?.includes(selectedSeason)) return false
      }

      // Filtro attività
      if (selectedActivity !== 'all') {
        const hasActivity = coach.teams?.some(team => {
          const teamActivity = activities.find(a => a.id === team.activity_id)
          return teamActivity?.name === selectedActivity
        })
        if (!hasActivity) return false
      }

      // Filtro squadra
      if (selectedTeam !== 'all') {
        const hasTeam = coach.teams?.some(team => team.id === selectedTeam)
        if (!hasTeam) return false
      }

      // Filtro ricerca
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const matchesName = `${coach.first_name} ${coach.last_name}`.toLowerCase().includes(term)
        const matchesEmail = coach.email.toLowerCase().includes(term)
        const matchesLevel = coach.level?.toLowerCase().includes(term)

        if (!matchesName && !matchesEmail && !matchesLevel) return false
      }

      return true
    })
  }, [activities, coaches, selectedSeason, selectedActivity, selectedTeam, searchTerm])

  // Gestione selezione multipla
  const toggleCoachSelection = (coachId: string) => {
    const newSelection = new Set(selectedCoaches)
    if (newSelection.has(coachId)) {
      newSelection.delete(coachId)
    } else {
      newSelection.add(coachId)
    }
    setSelectedCoaches(newSelection)
  }

  const selectAllCoaches = () => {
    if (selectedCoaches.size === filteredCoaches.length) {
      setSelectedCoaches(new Set())
    } else {
      setSelectedCoaches(new Set(filteredCoaches.filter(c => c.collaborator_type !== 'admin').map(c => c.id)))
    }
  }

  // Gestione operazioni massive
  const handleBulkOperation = async (operation: string, parameters: any) => {
    if (selectedCoaches.size === 0) return

    setBulkLoading(true)
    try {
      const response = await fetch('/api/admin/coaches/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation,
          coachIds: Array.from(selectedCoaches),
          parameters,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('Errore operazione massiva:', result.error)
        toast.error(`Errore: ${result.error}`)
        return
      }

      toast.success(result.message)

      // Ricarica i dati per aggiornare la UI
      await loadCoaches()

      // Reset selezione
      setSelectedCoaches(new Set())

    } catch (error) {
      console.error('Errore operazione massiva:', error)
      toast.error('Errore durante l\'operazione massiva')
    } finally {
      setBulkLoading(false)
    }
  }

  const handleTeamAssignmentRequest = () => {
    setBulkOperation('assign_to_team')
    setShowTeamAssignmentModal(true)
    setShowBulkModal(false)
  }

  const handleBulkModalConfirm = (operation: string, parameters: Record<string, unknown>) => {
    handleBulkOperation(operation, parameters)
    setShowBulkModal(false)
  }

  const handleTeamAssignmentConfirm = (data: {
    teamIds: string[]
    jerseyNumber?: string
    membershipFeeId?: string
  }) => {
    if (bulkOperation === 'assign_to_team') {
      handleBulkOperation(bulkOperation, data)
    }
    setShowTeamAssignmentModal(false)
    setBulkOperation(null)
  }

  const handleOpenBulkModal = () => {
    if (selectedCoaches.size === 0) {
      toast.error('Seleziona almeno un collaboratore per eseguire operazioni massive')
      return
    }
    setShowBulkModal(true)
  }

  const handleCollaboratorSubmit = async (data: CollaboratorFormData) => {
    setCollaboratorSubmitting(true)
    try {
      const response = await fetch('/api/admin/collaborators', { method: editingCollaboratorId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editingCollaboratorId ? { ...data, id: editingCollaboratorId } : data) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Impossibile salvare il collaboratore')
      toast.success(editingCollaborator ? 'Collaboratore aggiornato' : 'Collaboratore creato')
      setShowCollaboratorModal(false); setEditingCollaborator(null); setEditingCollaboratorId(null); await loadCoaches()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Impossibile salvare il collaboratore') } finally { setCollaboratorSubmitting(false) }
  }

  const openCollaboratorEdit = (coach: CoachWithDetails) => {
    const team = coach.teams?.[0]
    setEditingCollaboratorId(coach.id)
    setEditingCollaborator({ first_name: coach.first_name, last_name: coach.last_name, email: coach.email || '', phone: coach.phone || '', birth_date: coach.birth_date || '', collaborator_type: coach.collaborator_type, season_id: selectedSeason !== 'all' ? selectedSeason : coach.season_ids?.[0] || seasons.find((season) => season.is_active)?.id || '', level: coach.level || '', specialization: coach.specialization || '', started_on: coach.started_on || '', team_id: team?.id || '', team_role: team?.role === 'assistant_coach' ? 'assistant_coach' : 'head_coach' })
    setShowCollaboratorModal(true)
  }

  const openCollaboratorDetails = (coach: CoachWithDetails) => {
    setDetailsCollaborator(coach)
  }

  const removeCollaborator = async (coach: CoachWithDetails) => {
    if (selectedSeason === 'all') { toast.error('Seleziona una stagione prima di rimuovere un collaboratore'); return }
    if (!window.confirm(`Rimuovere ${coach.first_name} ${coach.last_name} dalla stagione selezionata?`)) return
    const response = await fetch('/api/admin/collaborators', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: coach.id, season_id: selectedSeason }) })
    const result = await response.json()
    if (!response.ok) { toast.error(result.error || 'Impossibile rimuovere il collaboratore'); return }
    toast.success(result.archived ? 'Collaboratore archiviato' : 'Collaboratore rimosso dalla stagione')
    await loadCoaches()
  }

  if (loading) {
    return <LoadingState label="Caricamento collaboratori..." />
  }

  return (
    <div className="space-y-6">
      {/* Header con statistiche */}
      <section className="cs-card cs-card--primary p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Collaboratori</h1>
            <p className="text-secondary mt-2">
              {filteredCoaches.length} collaboratori trovati • {selectedCoaches.size} selezionati
            </p>
          </div>
          <div className="flex gap-3 mt-4 lg:mt-0">
            <button className="cs-btn cs-btn--outline">
              Esporta CSV
            </button>
            <button onClick={() => { setEditingCollaborator(null); setEditingCollaboratorId(null); setShowCollaboratorModal(true) }} className="cs-btn cs-btn--primary">
              Nuovo Collaboratore
            </button>
            <button onClick={handleOpenBulkModal} className="cs-btn cs-btn--primary">
              Nuova Operazione Massiva
            </button>
          </div>
        </div>
      </section>

      {/* Filtri di contesto */}
      <section className="cs-card cs-card--primary p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="cs-field__label">Stagione</label>
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              className="cs-select"
            >
              <option value="all">Tutte le stagioni</option>
              {seasons.map(season => (
                <option key={season.id} value={season.id}>
                  {season.name} {season.is_active && '(Attiva)'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="cs-field__label">Attività</label>
            <select
              value={selectedActivity}
              onChange={(e) => setSelectedActivity(e.target.value)}
              className="cs-select"
            >
              <option value="all">Tutte le attività</option>
              {activities.map(activity => (
                <option key={activity.id} value={activity.name}>
                  {activity.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="cs-field__label">Squadra</label>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="cs-select"
            >
              <option value="all">Tutte le squadre</option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="cs-field__label">Cerca</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nome, email, livello..."
              className="cs-input"
            />
          </div>
        </div>
      </section>

      {/* Griglia collaboratori */}
      <section className="cs-card cs-card--primary">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Elenco Collaboratori</h2>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedCoaches.size === filteredCoaches.length && filteredCoaches.length > 0}
                  onChange={selectAllCoaches}
                  className="rounded"
                />
                <span className="text-sm text-secondary">Seleziona tutti</span>
              </label>
            </div>
          </div>
        </div>

        <div className="hidden md:block">
          <table className="cs-table">
            <thead>
              <tr>
                <th className="p-4 text-left text-sm font-medium w-12">
                  <input
                    type="checkbox"
                    checked={selectedCoaches.size === filteredCoaches.length && filteredCoaches.length > 0}
                    onChange={selectAllCoaches}
                    className="rounded"
                  />
                </th>
                <th className="p-4 text-left text-sm font-medium">Collaboratore</th>
                <th className="p-4 text-left text-sm font-medium">Squadre</th>
                <th className="p-4 text-left text-sm font-medium">Livello</th>
                <th className="p-4 text-left text-sm font-medium">Specializzazione</th>
                <th className="p-4 text-left text-sm font-medium">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filteredCoaches.map(coach => (
                <tr key={coach.id}>
                  <td className="p-4">
                    <input
                      type="checkbox"
                      checked={selectedCoaches.has(coach.id)}
                      disabled={coach.collaborator_type === 'admin'}
                      onChange={() => toggleCoachSelection(coach.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="p-4">
                    <div>
                      <div className="font-medium">
                        {coach.first_name} {coach.last_name}
                      </div>
                      <div className="text-sm text-secondary">{coach.email}</div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {coach.teams?.map(team => (
                        <span key={team.id} className="cs-badge cs-badge--success">
                          {team.name} ({team.role})
                        </span>
                      ))}
                      {(!coach.teams || coach.teams.length === 0) && (<span className="text-secondary text-sm">Nessuna squadra</span>)}
                    </div>
                  </td>
                  <td className="p-4 text-sm">
                    {coach.level || '-'}
                  </td>
                  <td className="p-4 text-sm">
                    {coach.specialization || '-'}
                  </td>
                  <td className="p-4">
                    <button className="cs-btn cs-btn--outline cs-btn--sm" onClick={() => openCollaboratorDetails(coach)}>
                      Dettagli
                    </button>
                    <button className="cs-btn cs-btn--outline cs-btn--sm ml-2" onClick={() => openCollaboratorEdit(coach)}>Modifica</button>
                    <button className="cs-btn cs-btn--danger cs-btn--sm ml-2" onClick={() => void removeCollaborator(coach)}>Rimuovi</button>
                    <span className="ml-2"><CollaboratorAccountActions id={coach.id} name={`${coach.first_name} ${coach.last_name}`} email={coach.email} account={coach.account} role={coach.collaborator_type} onChanged={() => void loadCoaches()} /></span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredCoaches.length === 0 && (<EmptyState title="Nessun collaboratore trovato con i filtri selezionati" />)}
        </div>

        {/* Mobile cards */}
        <div className="md:hidden p-4 space-y-3">
          {filteredCoaches.map(coach => (
            <div key={coach.id} className="cs-card">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedCoaches.has(coach.id)}
                  disabled={coach.collaborator_type === 'admin'}
                  onChange={() => toggleCoachSelection(coach.id)}
                  className="rounded mt-1"
                />
                <div className="flex-1">
                  <div className="font-semibold">{coach.first_name} {coach.last_name}</div>
                  <div className="text-sm text-secondary">{coach.email}</div>
                  <div className="mt-2 grid gap-2 text-sm">
                    <div>
                      <strong>Squadre:</strong>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {coach.teams?.length ? coach.teams.map(team => (
                          <span key={team.id} className="cs-badge cs-badge--success">{team.name} ({team.role})</span>
                        )) : <span className="text-secondary">Nessuna squadra</span>}
                      </div>
                    </div>
                    <div><strong>Livello:</strong> {coach.level || '-'}</div>
                    <div><strong>Specializzazione:</strong> {coach.specialization || '-'}</div>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <div className="grid grid-cols-2 gap-2"><button className="cs-btn cs-btn--outline cs-btn--sm" onClick={() => openCollaboratorDetails(coach)}>Dettagli</button><button className="cs-btn cs-btn--outline cs-btn--sm" onClick={() => openCollaboratorEdit(coach)}>Modifica</button></div>
                <div className="mt-2 flex gap-2"><button className="cs-btn cs-btn--danger cs-btn--sm flex-1" onClick={() => void removeCollaborator(coach)}>Rimuovi</button><CollaboratorAccountActions id={coach.id} name={`${coach.first_name} ${coach.last_name}`} email={coach.email} account={coach.account} role={coach.collaborator_type} onChanged={() => void loadCoaches()} /></div>
              </div>
            </div>
          ))}
          {filteredCoaches.length === 0 && (<div className="p-4 text-center text-secondary">Nessun collaboratore trovato con i filtri selezionati</div>)}
        </div>
      </section>

      {/* Barra azioni massive (visibile solo quando ci sono selezioni) */}
      {selectedCoaches.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 cs-card p-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">
              {selectedCoaches.size} collaboratori selezionati
            </span>
            <button onClick={handleOpenBulkModal} disabled={bulkLoading} className="cs-btn cs-btn--primary cs-btn--sm disabled:opacity-50">
              {bulkLoading ? 'Caricamento...' : 'Operazioni Massive'}
            </button>
          </div>
        </div>
      )}

      {/* Modal Operazioni Massive */}
      <BulkOperationsModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        onConfirm={handleBulkModalConfirm}
        onTeamAssignmentRequest={handleTeamAssignmentRequest}
        selectedCount={selectedCoaches.size}
        userType="coaches"
        loading={bulkLoading}
        selectedUsers={filteredCoaches.filter(coach => selectedCoaches.has(coach.id))}
      />

      {/* Modal Assegnazione Squadra */}
      <TeamAssignmentModal
        isOpen={showTeamAssignmentModal}
        onClose={() => {
          setShowTeamAssignmentModal(false)
          setBulkOperation(null)
        }}
        onSubmit={handleTeamAssignmentConfirm}
        athleteIds={Array.from(selectedCoaches)}
        loading={bulkLoading}
        userType="coaches"
      />

      <CollaboratorModal isOpen={showCollaboratorModal} collaborator={editingCollaborator} seasons={seasons} activities={activities} teams={teams} isSubmitting={collaboratorSubmitting} onSubmit={handleCollaboratorSubmit} onClose={() => { setShowCollaboratorModal(false); setEditingCollaborator(null); setEditingCollaboratorId(null) }} />

      <DetailsDrawer
        open={detailsCollaborator !== null}
        onClose={() => setDetailsCollaborator(null)}
        title="Dettaglio collaboratore"
        size="lg"
      >
        {detailsCollaborator && (
          <div className="space-y-5">
            <div>
              <h3 className="text-xl font-semibold">{detailsCollaborator.first_name} {detailsCollaborator.last_name}</h3>
              <p className="text-secondary">{detailsCollaborator.email || 'Email non indicata'}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="cs-card p-4">
                <div className="text-secondary text-sm">Tipo</div>
                <div className="font-semibold capitalize">{detailsCollaborator.collaborator_type}</div>
              </div>
              <div className="cs-card p-4">
                <div className="text-secondary text-sm">Account</div>
                <div className="font-semibold">{detailsCollaborator.account ? detailsCollaborator.account.status : 'Senza account'}</div>
              </div>
            </div>
            <div className="cs-card p-4">
              <h4 className="font-semibold mb-2">Squadre assegnate</h4>
              {detailsCollaborator.teams.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {detailsCollaborator.teams.map((team) => (
                    <span key={`${team.id}-${team.role}`} className="cs-badge cs-badge--success">{team.name} ({team.role})</span>
                  ))}
                </div>
              ) : <p className="text-secondary text-sm">Nessuna squadra assegnata</p>}
            </div>
            <div className="cs-card p-4">
              <h4 className="font-semibold mb-2">Dati collaborazione</h4>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div><dt className="text-secondary">Telefono</dt><dd>{detailsCollaborator.phone || '—'}</dd></div>
                <div><dt className="text-secondary">Data di nascita</dt><dd>{detailsCollaborator.birth_date || '—'}</dd></div>
                <div><dt className="text-secondary">Livello</dt><dd>{detailsCollaborator.level || '—'}</dd></div>
                <div><dt className="text-secondary">Specializzazione</dt><dd>{detailsCollaborator.specialization || '—'}</dd></div>
              </dl>
            </div>
          </div>
        )}
      </DetailsDrawer>
    </div>
  )
}
