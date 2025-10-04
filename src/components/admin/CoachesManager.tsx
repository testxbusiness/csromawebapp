'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Coach, Team, Activity, Season } from './coachTypes'
import BulkOperationsModal from './BulkOperationsModal'
import TeamAssignmentModal from './TeamAssignmentModal'

interface CoachWithDetails extends Coach {
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

  const supabase = createClient()

  // Filtri di contesto
  const [selectedSeason, setSelectedSeason] = useState<string>('all')
  const [selectedActivity, setSelectedActivity] = useState<string>('all')
  const [selectedTeam, setSelectedTeam] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  const loadCoaches = useCallback(async () => {
    try {
      // Carica coach con dettagli completi
      const response = await fetch('/api/admin/coaches')
      const result = await response.json()

      if (!response.ok) {
        console.error('Errore caricamento collaboratori:', result.error)
        setCoaches([])
        return
      }

      setCoaches(result.coaches || [])
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
        .select('id, name, is_active')
        .order('created_at', { ascending: false })

      // Carica attività
      const { data: activitiesData } = await supabase
        .from('activities')
        .select('id, name')
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
        // TODO: Implementare filtro stagione quando disponibile nel modello dati
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
  }, [coaches, selectedSeason, selectedActivity, selectedTeam, searchTerm])

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
      setSelectedCoaches(new Set(filteredCoaches.map(c => c.id)))
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
        alert(`Errore: ${result.error}`)
        return
      }

      alert(result.message)

      // Ricarica i dati per aggiornare la UI
      await loadCoaches()

      // Reset selezione
      setSelectedCoaches(new Set())

    } catch (error) {
      console.error('Errore operazione massiva:', error)
      alert('Errore durante l\'operazione massiva')
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
      alert('Seleziona almeno un collaboratore per eseguire operazioni massive')
      return
    }
    setShowBulkModal(true)
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Caricamento collaboratori...</p>
      </div>
    )
  }

  return (
    <div className="pace-y-6">
      {/* Header con statistiche */}
      <section className="cs-card p-6">
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
            <button onClick={handleOpenBulkModal} className="cs-btn cs-btn--primary">
              Nuova Operazione Massiva
            </button>
          </div>
        </div>
      </section>

      {/* Filtri di contesto */}
      <section className="cs-card p-6">
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
      <section className="cs-card">
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

        <div className="overflow-x-auto">
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
                    <button className="cs-btn cs-btn--outline cs-btn--sm">
                      Dettagli
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredCoaches.length === 0 && (<div className="p-8 text-center text-secondary">Nessun collaboratore trovato con i filtri selezionati</div>)}
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
    </div>
  )
}
