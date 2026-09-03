'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'
import type { Athlete, AthleteCreateData, Team, Activity, Season } from './athleteTypes'
import BulkOperationsModal from './BulkOperationsModal'
import TeamAssignmentModal from './TeamAssignmentModal'
import DetailsDrawer from '@/components/shared/DetailsDrawer'
import AthleteCreateModal from './AthleteCreateModal'
import AthleteImportModal from './AthleteImportModal'
import CollaboratorAccountActions from './CollaboratorAccountActions'
import { getCertificateStatus, type CertificateStatus } from '@/lib/admin/certificate-status'

interface AthleteWithDetails extends Athlete {
  teams: Array<{
    id: string
    name: string
    jersey_number?: string
    activity_id?: string
  }>
}

export default function AthletesManager({ embedded = false }: { embedded?: boolean }) {
  const [athletes, setAthletes] = useState<AthleteWithDetails[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAthletes, setSelectedAthletes] = useState<Set<string>>(new Set())
  const [bulkOperation, setBulkOperation] = useState<string | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [showTeamAssignmentModal, setShowTeamAssignmentModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingAthlete, setEditingAthlete] = useState<AthleteCreateData | null>(null)
  const [createSubmitting, setCreateSubmitting] = useState(false)

  const [showDetails, setShowDetails] = useState(false)
  const [detailsAthlete, setDetailsAthlete] = useState<AthleteWithDetails | null>(null)

  function openAthleteDetails(a: AthleteWithDetails) {
  setDetailsAthlete(a)
  setShowDetails(true)
}

  const supabase = createClient()

  // Filtri di contesto
  const [selectedSeason, setSelectedSeason] = useState<string>('all')
  const [selectedActivity, setSelectedActivity] = useState<string>('all')
  const [selectedTeam, setSelectedTeam] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const searchParams = useSearchParams()
  const [certificateFilter, setCertificateFilter] = useState<'all' | 'attention' | CertificateStatus>(() => {
    const value = searchParams.get('certificateStatus')
    return value === 'attention' || value === 'missing' || value === 'expired' || value === 'expiring' || value === 'valid' ? value : 'all'
  })
  const certificateStats = useMemo(() => {
    let withoutCertificate = 0
    let expiredCertificate = 0
    let expiringCertificate = 0
    const now = Date.now()
    athletes.forEach((athlete) => {
      const status = getCertificateStatus(athlete.medical_certificate_expiry, new Date(now))
      if (status === 'missing') {
        withoutCertificate += 1
      } else if (status === 'expired') {
        expiredCertificate += 1
      } else if (status === 'expiring') {
        expiringCertificate += 1
      }
    })
    return { withoutCertificate, expiredCertificate, expiringCertificate }
  }, [athletes])

  const loadAthletes = useCallback(async () => {
    try {
      // Carica atleti con dettagli completi
      const response = await fetch('/api/admin/athletes')
      const result = await response.json()

      if (!response.ok) {
        console.error('Errore caricamento atleti:', result.error)
        setAthletes([])
        return
      }

      setAthletes(result.athletes || [])
    } catch (error) {
      console.error('Errore caricamento atleti:', error)
      setAthletes([])
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
      const activeSeason = seasonsData?.find((season) => season.is_active)
      if (activeSeason) {
        setSelectedSeason((current) => current === 'all' ? activeSeason.id : current)
      }
      setActivities(activitiesData || [])
      setTeams(teamsData || [])
    } catch (error) {
      console.error('Errore caricamento dati contesto:', error)
    }
  }, [supabase])

  useEffect(() => {
    loadAthletes()
    loadContextData()
  }, [loadAthletes, loadContextData])

  // Filtra atleti in base al contesto
  const filteredAthletes = useMemo(() => {
    return athletes.filter(athlete => {
      // Filtro stagione
      if (selectedSeason !== 'all') {
        if (!athlete.season_ids?.includes(selectedSeason)) return false
      }

      // Filtro attività
      if (selectedActivity !== 'all') {
        const hasActivity = athlete.teams?.some(team => {
          const teamActivity = activities.find(a => a.id === team.activity_id)
          return teamActivity?.name === selectedActivity
        })
        if (!hasActivity) return false
      }

      // Filtro squadra
      if (selectedTeam === 'none') {
        if (athlete.teams && athlete.teams.length > 0) return false
      } else if (selectedTeam !== 'all') {
        const hasTeam = athlete.teams?.some(team => team.id === selectedTeam)
        if (!hasTeam) return false
      }

      // Filtro ricerca
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const matchesName = `${athlete.first_name} ${athlete.last_name}`.toLowerCase().includes(term)
        const matchesEmail = athlete.email?.toLowerCase().includes(term) ?? false
        const matchesMembership = athlete.membership_number?.toLowerCase().includes(term)

        if (!matchesName && !matchesEmail && !matchesMembership) return false
      }

      const certificateStatus = getCertificateStatus(athlete.medical_certificate_expiry)
      if (certificateFilter === 'attention' && certificateStatus === 'valid') return false
      if (certificateFilter !== 'all' && certificateFilter !== 'attention' && certificateStatus !== certificateFilter) return false

      return true
    })
  }, [athletes, selectedSeason, selectedActivity, selectedTeam, searchTerm, activities, certificateFilter])

  // Gestione selezione multipla
  const toggleAthleteSelection = (athleteId: string) => {
    const newSelection = new Set(selectedAthletes)
    if (newSelection.has(athleteId)) {
      newSelection.delete(athleteId)
    } else {
      newSelection.add(athleteId)
    }
    setSelectedAthletes(newSelection)
  }

  const selectAllAthletes = () => {
    if (selectedAthletes.size === filteredAthletes.length) {
      setSelectedAthletes(new Set())
    } else {
      setSelectedAthletes(new Set(filteredAthletes.map(a => a.id)))
    }
  }

  // Gestione operazioni massive
  const handleBulkOperation = async (operation: string, parameters: Record<string, unknown>) => {
    if (selectedAthletes.size === 0) return

    setBulkLoading(true)
    try {
      const response = await fetch('/api/admin/athletes/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation,
          athleteIds: Array.from(selectedAthletes),
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
      await loadAthletes()

      // Reset selezione
      setSelectedAthletes(new Set())
      setBulkOperation(null)

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
      // API expects a single teamId for athletes (not teamIds array)
      const teamId = Array.isArray(data.teamIds) && data.teamIds.length > 0 ? data.teamIds[0] : ''
      handleBulkOperation(bulkOperation, {
        teamId,
        jerseyNumber: data.jerseyNumber,
        membershipFeeId: data.membershipFeeId,
      })
    }
    setShowTeamAssignmentModal(false)
    setBulkOperation(null)
  }

  const handleOpenBulkModal = () => {
    if (selectedAthletes.size === 0) {
      import('@/components/ui/Toast').then(({ toast }) => toast.error('Seleziona almeno un atleta per eseguire operazioni massive')).catch(()=>{})
      return
    }
    setShowBulkModal(true)
  }

  const handleCreateAthlete = async (data: AthleteCreateData) => {
    setCreateSubmitting(true)
    try {
      const response = await fetch('/api/admin/athletes', {
        method: editingAthlete ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await response.json()

      if (!response.ok) {
        toast.error(`Errore: ${result.error || 'Impossibile creare l’atleta'}`)
        return
      }

      toast.success(editingAthlete ? 'Atleta aggiornato' : 'Atleta creato nella stagione selezionata')
      setShowCreateModal(false)
      setEditingAthlete(null)
      await loadAthletes()
    } catch (error) {
      console.error('Errore creazione atleta:', error)
      toast.error('Errore di rete')
    } finally {
      setCreateSubmitting(false)
    }
  }

  const openAthleteEdit = (athlete: AthleteWithDetails) => {
    const seasonId = selectedSeason !== 'all' ? selectedSeason : athlete.season_ids?.[0] || seasons.find((season) => season.is_active)?.id || ''
    const seasonTeamIds = new Set(teams.filter((team) => activities.some((activity) => activity.id === team.activity_id && activity.season_id === seasonId)).map((team) => team.id))
    const seasonTeams = (athlete.teams || []).filter((team) => seasonTeamIds.has(team.id))
    setEditingAthlete({
      id: athlete.id,
      first_name: athlete.first_name,
      last_name: athlete.last_name,
      email: athlete.email || null,
      phone: athlete.phone || null,
      birth_date: athlete.birth_date || null,
      season_id: seasonId,
      membership_number: athlete.membership_number || null,
      medical_certificate_expiry: athlete.medical_certificate_expiry || null,
      personal_notes: athlete.personal_notes || null,
      team_ids: seasonTeams.map((team) => team.id),
      jersey_numbers: Object.fromEntries(seasonTeams.map((team) => [team.id, team.jersey_number == null ? null : Number(team.jersey_number)])),
    })
    setShowCreateModal(true)
  }

  const removeAthleteFromSeason = async (athlete: AthleteWithDetails) => {
    if (selectedSeason === 'all') {
      toast.error('Seleziona una stagione prima di rimuovere un iscritto')
      return
    }
    if (!window.confirm(`Rimuovere ${athlete.first_name} ${athlete.last_name} dalla stagione selezionata? L’anagrafica resterà conservata.`)) return
    const response = await fetch('/api/admin/athletes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: athlete.id, season_id: selectedSeason }),
    })
    const result = await response.json()
    if (!response.ok) {
      toast.error(result.error || 'Impossibile rimuovere l’iscrizione')
      return
    }
    toast.success('Iscrizione rimossa dalla stagione')
    await loadAthletes()
  }

  if (loading) {
    return (
      <div className="cs-card p-6">
        <div className="cs-skeleton h-8 w-1/4 mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="cs-card p-4">
            <div className="cs-skeleton h-5 w-2/3 mb-2"></div>
            <div className="cs-skeleton h-4 w-1/2"></div>
          </div>
          <div className="cs-card p-4">
            <div className="cs-skeleton h-5 w-2/3 mb-2"></div>
            <div className="cs-skeleton h-4 w-1/2"></div>
          </div>
          <div className="cs-card p-4">
            <div className="cs-skeleton h-5 w-2/3 mb-2"></div>
            <div className="cs-skeleton h-4 w-1/2"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header con statistiche */}
      <section className="cs-card cs-card--primary p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div>
            {!embedded && <h1 className="text-2xl font-bold">Atleti</h1>}
            <p className="text-secondary mt-2">
              {filteredAthletes.length} atleti trovati • {selectedAthletes.size} selezionati
            </p>
          </div>
          <div className="flex gap-3 mt-4 lg:mt-0">
            <button className="cs-btn cs-btn--outline">
              Esporta CSV
            </button>
            <button className="cs-btn cs-btn--outline" onClick={() => setShowImportModal(true)}>
              Importa Atleti
            </button>
            <button className="cs-btn cs-btn--primary" onClick={() => setShowCreateModal(true)}>
              Nuovo Atleta
            </button>
            <button
              onClick={handleOpenBulkModal}
              className="cs-btn cs-btn--primary"
            >
              Nuova Operazione Massiva
            </button>
          </div>
        </div>
      </section>

      <AthleteCreateModal
        isOpen={showCreateModal}
        athlete={editingAthlete}
        seasons={seasons}
        activities={activities}
        teams={teams}
        isSubmitting={createSubmitting}
        onSubmit={handleCreateAthlete}
        onClose={() => { setShowCreateModal(false); setEditingAthlete(null) }}
      />

      <AthleteImportModal
        isOpen={showImportModal}
        seasons={seasons}
        onComplete={() => { void loadAthletes() }}
        onClose={() => setShowImportModal(false)}
      />

<DetailsDrawer
  open={showDetails}
  onClose={() => setShowDetails(false)}
  title="Dettaglio Atleta"
  size="lg"
>
  {detailsAthlete && (
    <div className="cs-grid cs-grid--2-1" style={{ gap: 16 }}>
      {/* Colonna sinistra: anagrafica */}
      <div className="cs-card">
        <h3 className="cs-card__title">
          {detailsAthlete.first_name} {detailsAthlete.last_name}
        </h3>
        <div className="cs-card__meta" style={{ marginTop: 6 }}>
          {detailsAthlete.email}
        </div>

        <div className="cs-grid" style={{ marginTop: 12, gap: 12 }}>
          <div>
            <div className="text-secondary text-sm">Tessera</div>
            <div className="font-semibold">{detailsAthlete.membership_number || '—'}</div>
          </div>

          <div>
            <div className="text-secondary text-sm">Certificato medico</div>
            <div className="font-semibold">
              {detailsAthlete.medical_certificate_expiry
                ? new Date(detailsAthlete.medical_certificate_expiry).toLocaleDateString('it-IT')
                : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Colonna destra: squadre */}
      <div className="cs-card">
        <h4 className="font-semibold mb-2">Squadre</h4>
        {detailsAthlete.teams?.length ? (
          <div className="flex flex-wrap gap-2">
            {detailsAthlete.teams.map(t => (
              <span key={t.id} className="cs-badge cs-badge--neutral">
                {t.name}{t.jersey_number ? ` #${t.jersey_number}` : ''}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-secondary text-sm">Nessuna squadra</div>
        )}
      </div>
    </div>
  )}
</DetailsDrawer>

      {/* Filtri di contesto */}
      <section className="cs-card cs-card--primary p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="cs-card cs-card--primary bg-[color:var(--cs-primary)]/5 border border-[color:var(--cs-primary)]/30">
            <p className="text-sm text-[color:var(--cs-primary)] font-semibold uppercase tracking-wide">Certificato Scaduto</p>
            <p className="text-3xl font-bold mt-2">{certificateStats.expiredCertificate}</p>
            <p className="text-secondary text-xs mt-1">Atleti con certificato già scaduto</p>
          </div>
          <div className="cs-card">
            <p className="text-sm text-secondary font-semibold uppercase tracking-wide">Certificato Mancante</p>
            <p className="text-3xl font-bold mt-2">{certificateStats.withoutCertificate}</p>
            <p className="text-secondary text-xs mt-1">Atleti senza data di scadenza inserita</p>
          </div>
          <div className="cs-card">
            <p className="text-sm text-secondary font-semibold uppercase tracking-wide">In scadenza entro 30 giorni</p>
            <p className="text-3xl font-bold mt-2">{certificateStats.expiringCertificate}</p>
            <p className="text-secondary text-xs mt-1">Atleti da ricontattare o aggiornare</p>
          </div>
          <div className="cs-card">
            <p className="text-sm text-secondary font-semibold uppercase tracking-wide">Totale Atleti</p>
            <p className="text-3xl font-bold mt-2">{athletes.length}</p>
            <p className="text-secondary text-xs mt-1">Conteggio globale del database</p>
          </div>
        </div>
      </section>

      <section className="cs-card cs-card--primary p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
              <option value="none">Nessuna squadra</option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="cs-field__label">Stato certificato</label>
            <select
              value={certificateFilter}
              onChange={(e) => setCertificateFilter(e.target.value as 'all' | 'attention' | CertificateStatus)}
              className="cs-select"
            >
              <option value="all">Tutti</option>
              <option value="attention">Da verificare</option>
              <option value="expired">Scaduti</option>
              <option value="missing">Mancanti</option>
              <option value="expiring">In scadenza entro 30 giorni</option>
              <option value="valid">Regolari</option>
            </select>
          </div>

          <div>
            <label className="cs-field__label">Cerca</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nome, email, tessera..."
              className="cs-input"
            />
          </div>
        </div>
      </section>

      {/* Griglia atleti */}
      <section className="cs-card cs-card--primary ">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Elenco Atleti</h2>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedAthletes.size === filteredAthletes.length && filteredAthletes.length > 0}
                  onChange={selectAllAthletes}
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
                    checked={selectedAthletes.size === filteredAthletes.length && filteredAthletes.length > 0}
                    onChange={selectAllAthletes}
                    className="rounded"
                  />
                </th>
                <th className="p-4 text-left text-sm font-medium">Atleta</th>
                <th className="p-4 text-left text-sm font-medium">Squadre</th>
                <th className="p-4 text-left text-sm font-medium">Tessera</th>
                <th className="p-4 text-left text-sm font-medium">Certificato</th>
                <th className="p-4 text-left text-sm font-medium">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filteredAthletes.map(athlete => (
                <tr key={athlete.id}>
                  <td className="p-4">
                  <input
                    type="checkbox"
                    checked={selectedAthletes.has(athlete.id)}
                    onChange={() => toggleAthleteSelection(athlete.id)}
                  />
                  </td>
                  <td className="p-4">
                    <div>
                      <div className="font-medium">
                        {athlete.first_name} {athlete.last_name}
                      </div>
                      <div className="text-sm text-secondary">{athlete.email}</div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {athlete.teams?.map(team => (
                        <span key={team.id} className="cs-badge cs-badge--neutral">
                          {team.name} {team.jersey_number && `#${team.jersey_number}`}
                        </span>
                      ))}
                      {(!athlete.teams || athlete.teams.length === 0) && (<span className="text-secondary text-sm">Nessuna squadra</span>)}
                    </div>
                  </td>
                  <td className="p-4 text-sm">
                    {athlete.membership_number || '-'}
                  </td>
                  <td className="p-4 text-sm">
                    {athlete.medical_certificate_expiry
                      ? new Date(athlete.medical_certificate_expiry).toLocaleDateString('it-IT')
                      : '-'}
                  </td>
                  <td className="p-4">
                    <button className="cs-btn cs-btn--outline cs-btn--sm"
                      onClick={() => openAthleteDetails(athlete)}
                    >
                      Dettagli
                    </button>
                    <button className="cs-btn cs-btn--outline cs-btn--sm ml-2" onClick={() => openAthleteEdit(athlete)}>
                      Modifica
                    </button>
                    <button className="cs-btn cs-btn--danger cs-btn--sm ml-2" onClick={() => void removeAthleteFromSeason(athlete)}>
                      Rimuovi
                    </button>
                    <span className="ml-2">
                      <CollaboratorAccountActions
                        id={athlete.id}
                        name={`${athlete.first_name} ${athlete.last_name}`}
                        email={athlete.email}
                        account={athlete.account ?? null}
                        role="athlete"
                        onChanged={() => void loadAthletes()}
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredAthletes.length === 0 && (<div className="p-8 text-center text-secondary">Nessun atleta trovato con i filtri selezionati</div>)}
        </div>
        {/* Mobile cards */}
        <div className="md:hidden p-4 space-y-3">
          {filteredAthletes.map(athlete => (
            <div key={athlete.id} className="cs-card">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedAthletes.has(athlete.id)}
                  onChange={() => toggleAthleteSelection(athlete.id)}
                />
                <div className="flex-1">
                  <div className="font-semibold">{athlete.first_name} {athlete.last_name}</div>
                  <div className="text-sm text-secondary">{athlete.email}</div>
                  <div className="mt-2 grid gap-2 text-sm">
                    <div>
                      <strong>Squadre:</strong>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {athlete.teams?.length ? athlete.teams.map(team => (
                          <span key={team.id} className="cs-badge cs-badge--neutral">{team.name} {team.jersey_number && `#${team.jersey_number}`}</span>
                        )) : <span className="text-secondary">Nessuna squadra</span>}
                      </div>
                    </div>
                    <div><strong>Tessera:</strong> {athlete.membership_number || '-'}</div>
                    <div><strong>Certificato:</strong> {athlete.medical_certificate_expiry ? new Date(athlete.medical_certificate_expiry).toLocaleDateString('it-IT') : '-'}</div>
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button className="cs-btn cs-btn--outline cs-btn--sm" onClick={() => openAthleteDetails(athlete)}>Dettagli</button>
                <button className="cs-btn cs-btn--outline cs-btn--sm" onClick={() => openAthleteEdit(athlete)}>Modifica</button>
                <button className="cs-btn cs-btn--danger cs-btn--sm" onClick={() => void removeAthleteFromSeason(athlete)}>Rimuovi</button>
                <CollaboratorAccountActions
                  id={athlete.id}
                  name={`${athlete.first_name} ${athlete.last_name}`}
                  email={athlete.email}
                  account={athlete.account ?? null}
                  role="athlete"
                  onChanged={() => void loadAthletes()}
                />
              </div>
            </div>
          ))}
          {filteredAthletes.length === 0 && (<div className="p-4 text-center text-secondary">Nessun atleta trovato con i filtri selezionati</div>)}
        </div>
      </section>

      {/* Barra azioni massive (visibile solo quando ci sono selezioni) */}
      {selectedAthletes.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 cs-card p-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">
              {selectedAthletes.size} atleti selezionati
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
        selectedCount={selectedAthletes.size}
        userType="athletes"
        loading={bulkLoading}
        selectedUsers={filteredAthletes.filter(athlete => selectedAthletes.has(athlete.id))}
      />

      {/* Modal Assegnazione Squadra con Piano Pagamento */}
      <TeamAssignmentModal
        isOpen={showTeamAssignmentModal}
        onClose={() => {
          setShowTeamAssignmentModal(false)
          setBulkOperation(null)
        }}
        onSubmit={handleTeamAssignmentConfirm}
        athleteIds={Array.from(selectedAthletes)}
        loading={bulkLoading}
        userType="athletes"
      />
    </div>
  )
}
