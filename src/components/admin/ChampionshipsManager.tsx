'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardTitle, CardMeta, Table, TableActions, Button, Input, Select, toast, Modal } from '@/components/ui'
import { importFromExcel, ImportColumn } from '@/lib/utils/excelImport'

type ClubTeam = {
  id: string
  code: string
  name: string
  is_home_club: boolean
  team_id?: string | null
  teams?: {
    id: string
    name: string
    code?: string | null
  } | null
}

type GroupTeam = {
  id: string
  championship_club_team_id: string
  is_home_club: boolean
  championship_club_teams?: ClubTeam
}

type ChampionshipGroup = {
  id: string
  name: string
  phase: string
  sort_order: number
  championship_group_teams?: GroupTeam[]
}

type Championship = {
  id: string
  name: string
  status: string
  sport: string
  start_date?: string | null
  end_date?: string | null
  championship_groups?: ChampionshipGroup[]
}

type MatchSet = {
  id?: string
  set_number: number
  home_points: number
  away_points: number
}

type Match = {
  id: string
  match_day: number | null
  round_label?: string | null
  match_date?: string | null
  start_time?: string | null
  status: string
  location_text?: string | null
  event_id?: string | null
  home_club_team_id: string
  away_club_team_id: string
  championship_match_sets?: MatchSet[]
  home_club_team?: ClubTeam
  away_club_team?: ClubTeam
}

type Standing = {
  championship_group_id: string
  club_team_id: string
  matches_played: number
  wins: number
  losses: number
  sets_for: number
  sets_against: number
  points_for: number
  points_against: number
  class_points: number
  set_ratio: number | null
  point_ratio: number | null
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Programmato',
  completed: 'Concluso',
  postponed: 'Rinviato',
  cancelled: 'Cancellato',
  forfeit: 'Forfait'
}

type Season = { id: string; name: string }
type Activity = { id: string; name: string; season_id: string }
type Team = { id: string; name: string; code?: string | null }
type ClubTeamOption = ClubTeam

type ManagerMode = 'admin' | 'coach' | 'athlete'

interface ChampionshipsManagerProps {
  mode?: ManagerMode
}

export default function ChampionshipsManager({ mode = 'admin' }: ChampionshipsManagerProps) {
  const supabase = createClient()
  const [championships, setChampionships] = useState<Championship[]>([])
  const [selectedChampionshipId, setSelectedChampionshipId] = useState<string | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [standings, setStandings] = useState<Standing[]>([])
  const [loading, setLoading] = useState(false)
  const [savingResult, setSavingResult] = useState(false)
  const [resultInput, setResultInput] = useState<string>('')
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null)
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [showTeamsModal, setShowTeamsModal] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '',
    sport: 'volleyball',
    status: 'draft',
    season_id: '',
    activity_id: '',
    start_date: '',
    end_date: '',
    group_name: 'Girone A',
    create_group: true,
  })
  const [groupForm, setGroupForm] = useState({ name: 'Girone A', phase: 'regular' })
  const [importGroupId, setImportGroupId] = useState<string | null>(null)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [seasons, setSeasons] = useState<Season[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [groupTeamsSelection, setGroupTeamsSelection] = useState<Record<string, { selected: boolean; is_home_club: boolean }>>({})
  const [teamSearch, setTeamSearch] = useState('')
  const [groupTeamsSaving, setGroupTeamsSaving] = useState(false)
  const [clubTeams, setClubTeams] = useState<ClubTeamOption[]>([])
  const [newClubTeam, setNewClubTeam] = useState({ code: '', name: '', is_home_club: false, team_id: '' })
  const [deleting, setDeleting] = useState<'group'|'championship'|null>(null)
  const [resultModalOpen, setResultModalOpen] = useState(false)
  const [resultEditingMatch, setResultEditingMatch] = useState<Match | null>(null)
  const [coachTeamIds, setCoachTeamIds] = useState<Set<string>>(new Set())
  const [athleteTeamIds, setAthleteTeamIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadChampionships()
    loadSelectData()
    if (mode === 'coach') {
      loadCoachTeams()
    } else if (mode === 'athlete') {
      loadAthleteTeams()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode === 'coach') {
      loadChampionships()
    } else if (mode === 'athlete') {
      loadChampionships()
    }
  }, [mode, coachTeamIds, athleteTeamIds])

  useEffect(() => {
    if (selectedChampionshipId) {
      loadClubTeams(selectedChampionshipId)
    } else {
      setClubTeams([])
    }
  }, [selectedChampionshipId])

  useEffect(() => {
    if (!selectedChampionshipId) return
    const championship = championships.find((c) => c.id === selectedChampionshipId)
    if (championship?.championship_groups && championship.championship_groups.length > 0) {
      const firstGroupId = championship.championship_groups[0].id
      setSelectedGroupId(firstGroupId)
      setImportGroupId(firstGroupId)
      initGroupTeamsSelection(firstGroupId)
    } else {
      setSelectedGroupId(null)
      setImportGroupId(null)
    }
  }, [selectedChampionshipId, championships])

  useEffect(() => {
    if (selectedGroupId) {
      loadGroupDetails(selectedGroupId)
    } else {
      setMatches([])
      setStandings([])
    }
  }, [selectedGroupId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Allinea importGroupId al girone selezionato di default
  useEffect(() => {
    if (selectedGroupId) {
      setImportGroupId(selectedGroupId)
    }
  }, [selectedGroupId])

  const loadChampionships = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('championships')
      .select(`
        id, name, status, sport, start_date, end_date,
        championship_groups (
          id, name, phase, sort_order,
          championship_group_teams (
            id, championship_club_team_id, is_home_club,
            championship_club_teams ( id, code, name, is_home_club, team_id, teams ( id, name, code ) )
          )
        )
      `)
      .order('created_at', { ascending: false })
      .order('sort_order', { referencedTable: 'championship_groups', ascending: true })

    if (error) {
      console.error('Errore caricamento campionati', error)
      toast.error('Impossibile caricare i campionati')
      setChampionships([])
      setLoading(false)
      return
    }

    let filtered = data || []
    if (mode === 'coach' && coachTeamIds.size > 0) {
      filtered = filtered.filter((c) =>
        c.championship_groups?.some((g: any) =>
          g.championship_group_teams?.some((t: any) => {
            const teamId = t.championship_club_teams?.team_id
            return teamId && coachTeamIds.has(teamId)
          })
        )
      )
    }
    if (mode === 'athlete' && athleteTeamIds.size > 0) {
      filtered = filtered.filter((c) =>
        c.championship_groups?.some((g: any) =>
          g.championship_group_teams?.some((t: any) => {
            const teamId = t.championship_club_teams?.team_id
            return teamId && athleteTeamIds.has(teamId)
          })
        )
      )
    }

    setChampionships(filtered)
    if (!selectedChampionshipId && data && data.length > 0) {
      setSelectedChampionshipId(filtered[0]?.id ?? null)
    }
    setLoading(false)
  }

  const loadSelectData = async () => {
    const [{ data: seasonsData }, { data: activitiesData }, { data: teamsData }] = await Promise.all([
      supabase.from('seasons').select('id, name').order('start_date', { ascending: false }),
      supabase.from('activities').select('id, name, season_id').order('name'),
      supabase.from('teams').select('id, name, code, coach_id').order('name')
    ])
    setSeasons(seasonsData || [])
    setActivities(activitiesData || [])
    setTeams(teamsData || [])
    if (seasonsData?.[0] && !createForm.season_id) {
      setCreateForm((prev) => ({ ...prev, season_id: seasonsData[0].id }))
    }
  }

  const loadCoachTeams = async () => {
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id
      if (!userId) return

      const [{ data: tc }, { data: direct }] = await Promise.all([
        supabase.from('team_coaches').select('team_id').eq('coach_id', userId),
        supabase.from('teams').select('id').eq('coach_id', userId)
      ])
      const ids = new Set<string>()
      tc?.forEach((t: any) => t.team_id && ids.add(t.team_id))
      direct?.forEach((t: any) => t.id && ids.add(t.id))
      setCoachTeamIds(ids)
    } catch (err) {
      console.error('Errore caricamento squadre coach', err)
    }
  }

  const loadAthleteTeams = async () => {
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id
      if (!userId) return
      const { data, error } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('profile_id', userId)
      if (error) throw error
      const ids = new Set<string>()
      data?.forEach((row: any) => row.team_id && ids.add(row.team_id))
      setAthleteTeamIds(ids)
    } catch (err) {
      console.error('Errore caricamento squadre atleta', err)
    }
  }

  const loadClubTeams = async (championshipId: string) => {
    const { data, error } = await supabase
      .from('championship_club_teams')
      .select('id, championship_id, code, name, is_home_club, team_id, teams(id, name, code)')
      .eq('championship_id', championshipId)
      .order('name')

    if (error) {
      console.error('Errore caricamento squadre campionato', error)
      toast.error('Impossibile caricare le squadre del campionato')
      setClubTeams([])
      return
    }
    setClubTeams(data || [])
  }

  const loadGroupDetails = async (groupId: string) => {
    setLoading(true)
    try {
      const [{ data: matchesData, error: matchesError }, { data: standingsData, error: standingsError }] = await Promise.all([
        supabase
          .from('championship_matches')
          .select(`
            id, match_day, round_label, match_date, start_time, status, location_text, event_id,
            home_club_team_id, away_club_team_id,
            championship_match_sets ( id, set_number, home_points, away_points ),
            home_club_team:home_club_team_id ( id, code, name, is_home_club, team_id, teams ( id, name, code ) ),
            away_club_team:away_club_team_id ( id, code, name, is_home_club, team_id, teams ( id, name, code ) )
          `)
          .eq('championship_group_id', groupId)
          .order('match_day', { ascending: true, nullsLast: true })
          .order('match_date', { ascending: true, nullsLast: true }),
        supabase
          .from('championship_standings_mv')
          .select('*')
          .eq('championship_group_id', groupId)
      ])

      if (matchesError) {
        console.error('Errore caricamento partite', matchesError)
        toast.error('Impossibile caricare le partite')
        setLoading(false)
        return
      }

      if (standingsError) {
        console.error('Errore classifica', standingsError)
        toast.error('Impossibile caricare la classifica')
      }

      setMatches(matchesData || [])
      setStandings(standingsData || [])
    } finally {
      setLoading(false)
    }
  }

  const currentGroups = useMemo(() => {
    return championships.find((c) => c.id === selectedChampionshipId)?.championship_groups || []
  }, [championships, selectedChampionshipId])

  const groupTeamMap = useMemo(() => {
    const map = new Map<string, GroupTeam>()
    currentGroups.forEach((g) => {
      g.championship_group_teams?.forEach((t) => map.set(t.championship_club_team_id, t))
    })
    return map
  }, [currentGroups])

  const clubTeamName = (clubTeamId: string) => {
    const fromGroup = groupTeamMap.get(clubTeamId)
    const club = fromGroup?.championship_club_teams
    if (club) return `${club.name}${club.code ? ` (${club.code})` : ''}`
    const fromList = clubTeams.find((c) => c.id === clubTeamId)
    if (fromList) return `${fromList.name}${fromList.code ? ` (${fromList.code})` : ''}`
    return clubTeamId
  }

  const formatScore = (sets?: MatchSet[]) => {
    if (!sets || sets.length === 0) return '—'
    const home = sets.filter((s) => s.home_points > s.away_points).length
    const away = sets.filter((s) => s.home_points < s.away_points).length
    return `${home}-${away}`
  }

  const formatSetsDetail = (sets?: MatchSet[]) => {
    if (!sets || sets.length === 0) return ''
    return sets
      .sort((a, b) => a.set_number - b.set_number)
      .map((s) => `${s.home_points}-${s.away_points}`)
      .join(', ')
  }

  const openResultEditor = (match: Match) => {
    const orderedSets = (match.championship_match_sets || []).sort((a, b) => a.set_number - b.set_number)
    const prefill = orderedSets.map((s) => `${s.home_points}-${s.away_points}`).join(', ')
    setResultInput(prefill)
    setEditingMatchId(match.id)
    setResultEditingMatch(match)
    setResultModalOpen(true)
  }

  const parseResultInput = (input: string) => {
    if (!input.trim()) return []
    return input.split(',').map((part) => {
      const [home, away] = part.trim().split('-').map((v) => parseInt(v, 10))
      if (Number.isNaN(home) || Number.isNaN(away)) {
        throw new Error('Formato non valido. Usa es. "25-20, 25-21, 28-26"')
      }
      return { home, away }
    })
  }

  const saveResult = async () => {
    if (!editingMatchId) return
    let setsToSave: { home: number; away: number }[] = []
    try {
      setsToSave = parseResultInput(resultInput)
    } catch (err: any) {
      toast.error(err.message || 'Formato punteggio non valido')
      return
    }

    setSavingResult(true)
    try {
      await supabase.from('championship_match_sets').delete().eq('match_id', editingMatchId)

      if (setsToSave.length > 0) {
        const payload = setsToSave.map((s, idx) => ({
          match_id: editingMatchId,
          set_number: idx + 1,
          home_points: s.home,
          away_points: s.away
        }))
        const { error: insertError } = await supabase.from('championship_match_sets').insert(payload)
        if (insertError) throw insertError
      }

      const newStatus = setsToSave.length > 0 ? 'completed' : 'scheduled'
      const { error: statusError } = await supabase
        .from('championship_matches')
        .update({ status: newStatus })
        .eq('id', editingMatchId)

      if (statusError) throw statusError

      toast.success('Risultato salvato e classifica aggiornata')
      setEditingMatchId(null)
      setResultEditingMatch(null)
      setResultModalOpen(false)
      setResultInput('')
      if (selectedGroupId) {
        await loadGroupDetails(selectedGroupId)
      }
    } catch (error) {
      console.error('Errore salvataggio risultato', error)
      toast.error('Impossibile salvare il risultato')
    } finally {
      setSavingResult(false)
    }
  }

  const changeStatus = async (matchId: string, status: string) => {
    setStatusUpdating(matchId)
    try {
      const { error } = await supabase
        .from('championship_matches')
        .update({ status })
        .eq('id', matchId)
      if (error) throw error
      toast.success('Stato partita aggiornato')
      if (selectedGroupId) await loadGroupDetails(selectedGroupId)
    } catch (err) {
      console.error('Errore aggiornamento stato', err)
      toast.error('Impossibile aggiornare lo stato')
    } finally {
      setStatusUpdating(null)
    }
  }

  const handleCreateChampionship = async () => {
    if (!createForm.name || !createForm.season_id) {
      toast.error('Nome e stagione sono obbligatori')
      return
    }

    setSavingResult(true)
    try {
      const { data: champ, error } = await supabase
        .from('championships')
        .insert({
          name: createForm.name,
          sport: createForm.sport,
          status: createForm.status,
          season_id: createForm.season_id,
          activity_id: createForm.activity_id || null,
          start_date: createForm.start_date || null,
          end_date: createForm.end_date || null,
        })
        .select('id')
        .single()

      if (error) throw error

      if (createForm.create_group && createForm.group_name) {
        const { error: groupError } = await supabase.from('championship_groups').insert({
          championship_id: champ.id,
          name: createForm.group_name,
          phase: 'regular',
          sort_order: 0
        })
        if (groupError) throw groupError
      }

      toast.success('Campionato creato')
      setShowCreateModal(false)
      setCreateForm((prev) => ({ ...prev, name: '', group_name: 'Girone A' }))
      await loadChampionships()
    } catch (err) {
      console.error('Errore creazione campionato', err)
      toast.error('Impossibile creare il campionato')
    } finally {
      setSavingResult(false)
    }
  }

  const handleCreateGroup = async () => {
    if (!selectedChampionshipId) {
      toast.error('Seleziona un campionato')
      return
    }
    if (!groupForm.name) {
      toast.error('Nome girone obbligatorio')
      return
    }
    setSavingResult(true)
    try {
      const { error } = await supabase.from('championship_groups').insert({
        championship_id: selectedChampionshipId,
        name: groupForm.name,
        phase: groupForm.phase,
        sort_order: (currentGroups.length || 0)
      })
      if (error) throw error
      toast.success('Girone creato')
      setShowGroupModal(false)
      setGroupForm({ name: 'Girone A', phase: 'regular' })
      await loadChampionships()
    } catch (err) {
      console.error('Errore creazione girone', err)
      toast.error('Impossibile creare il girone')
    } finally {
      setSavingResult(false)
    }
  }

  const matchImportColumns: Record<string, ImportColumn> = {
    giornata: { key: 'giornata', required: false, type: 'number' },
    data: { key: 'data', required: true, type: 'date' },
    ora: { key: 'ora', required: true, type: 'string' },
    casa: { key: 'casa', required: true, type: 'string' },
    casa_nome: { key: 'casa_nome', required: false, type: 'string' },
    ospiti: { key: 'ospiti', required: true, type: 'string' },
    ospiti_nome: { key: 'ospiti_nome', required: false, type: 'string' },
    luogo: { key: 'luogo', required: false, type: 'string' },
    note: { key: 'note', required: false, type: 'string' },
  }

  const handleImportMatches = async () => {
    const groupId = importGroupId || selectedGroupId
    if (!groupId) {
      toast.error('Seleziona un girone')
      return
    }
    if (!selectedChampionshipId) {
      toast.error('Seleziona un campionato')
      return
    }
    if (!importFile) {
      toast.error('Seleziona un file Excel')
      return
    }
    setImporting(true)
    try {
      const result = await importFromExcel<{ giornata?: number; data: string; ora: string; casa: string; casa_nome?: string; ospiti: string; ospiti_nome?: string; luogo?: string; note?: string }>(
        importFile,
        matchImportColumns,
        { skipFirstRow: true }
      )
      if (!result.success || result.validRows === 0) {
        toast.error(result.errors.join(', ') || 'File non valido')
        setImporting(false)
        return
      }

      const csrByCode = new Map<string, Team>()
      teams.forEach((t) => { if (t.code) csrByCode.set(t.code.trim().toUpperCase(), t) })

      const clubByCode = new Map<string, ClubTeamOption>()
      clubTeams.forEach((ct) => { clubByCode.set(ct.code.trim().toUpperCase(), ct) })

      // Codici CSRoma da considerare home_club anche se non mappati in teams
      const homeClubCodes = new Set(['PVA1', 'PVA2', 'CSROMA', 'CS ROMA', 'CSR'])

      const rows = result.data
      const payload: any[] = []
      const groupClubTeams: Set<string> = new Set()

      const ensureClubTeam = async (codeRaw: string, nameHint?: string) => {
        const code = codeRaw.trim().toUpperCase()
        if (!code) throw new Error('Codice squadra mancante')

        if (clubByCode.has(code)) {
          const existing = clubByCode.get(code)!
          // Se è CSRoma ma non marcata, aggiorna
          const csr = csrByCode.get(code)
          const shouldBeHome = !!csr || homeClubCodes.has(code)
          const needsUpdate = (shouldBeHome && !existing.is_home_club) || (csr && existing.team_id !== csr.id)
          if (needsUpdate) {
            const { data: upd, error: updErr } = await supabase
              .from('championship_club_teams')
              .update({
                is_home_club: shouldBeHome,
                team_id: csr?.id || existing.team_id,
                name: nameHint || existing.name
              })
              .eq('id', existing.id)
              .select('id, code, name, is_home_club, team_id')
              .single()
            if (updErr) throw updErr
            const full: ClubTeamOption = { ...upd, teams: csr ? { id: csr.id, name: csr.name, code: csr.code || null } : existing.teams }
            clubByCode.set(code, full)
            return full.id
          }
          return existing.id
        }

        const csr = csrByCode.get(code)
        const newTeam = {
          championship_id: selectedChampionshipId!,
          code,
          name: nameHint || csr?.name || code,
          is_home_club: !!csr || homeClubCodes.has(code),
          team_id: csr?.id || null,
          source: 'import_excel'
        }
        const { data: inserted, error } = await supabase
          .from('championship_club_teams')
          .insert(newTeam)
          .select('id, code, name, is_home_club, team_id')
          .single()
        if (error) throw error
        const full: ClubTeamOption = { ...inserted, teams: csr ? { id: csr.id, name: csr.name, code: csr.code || null } : null }
        clubByCode.set(code, full)
        return inserted.id
      }

      for (const row of rows) {
        const homeId = await ensureClubTeam(row.casa, row.casa_nome)
        const awayId = await ensureClubTeam(row.ospiti, row.ospiti_nome)
        groupClubTeams.add(homeId)
        groupClubTeams.add(awayId)

        const startTime = normalizeTime(row.ora)
        payload.push({
          championship_group_id: groupId,
          match_day: row.giornata ?? null,
          match_date: row.data ? row.data.toString().slice(0, 10) : null,
          start_time: startTime,
          location_text: row.luogo || null,
          notes: row.note || null,
          home_club_team_id: homeId,
          away_club_team_id: awayId,
          source: 'import_excel',
          status: 'scheduled'
        })
      }

      if (payload.length === 0) {
        toast.error('Nessuna riga valida importata')
        setImporting(false)
        return
      }

      const { error } = await supabase
        .from('championship_matches')
        .upsert(payload, { onConflict: 'championship_group_id,match_day,home_club_team_id,away_club_team_id' })
      if (error) throw error

      if (groupClubTeams.size > 0) {
        const upsertGroupTeams = Array.from(groupClubTeams).map((cctId) => ({
          championship_group_id: groupId,
          championship_club_team_id: cctId
        }))
        await supabase
          .from('championship_group_teams')
          .upsert(upsertGroupTeams, { onConflict: 'championship_group_id,championship_club_team_id' })
      }

      toast.success(`Importate ${payload.length} partite`)
      setShowImportModal(false)
      setImportFile(null)
      await loadClubTeams(selectedChampionshipId)
      await loadGroupDetails(groupId)
    } catch (err) {
      console.error('Errore import calendario', err)
      toast.error('Impossibile importare il calendario')
    } finally {
      setImporting(false)
    }
  }

  const selectedChampionship = championships.find((c) => c.id === selectedChampionshipId)
  const standingsWithNames = standings.map((s) => {
    const c = groupTeamMap.get(s.club_team_id)?.championship_club_teams
    return {
      ...s,
      team_name: c?.name || clubTeamName(s.club_team_id).replace(/\s*\([^)]*\)\s*$/, '')
    }
  })

  const formatDate = (value?: string | null) => {
    if (!value) return '—'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('it-IT')
  }

  const normalizeTime = (raw?: string | null) => {
    if (raw === undefined || raw === null || raw === '') return null
    // Excel time as fraction of day (number)
    if (typeof raw === 'number') {
      const totalSeconds = Math.round(raw * 24 * 3600)
      const h = Math.floor(totalSeconds / 3600) % 24
      const m = Math.floor((totalSeconds % 3600) / 60)
      const s = totalSeconds % 60
      const hh = h.toString().padStart(2, '0')
      const mm = m.toString().padStart(2, '0')
      const ss = s.toString().padStart(2, '0')
      return `${hh}:${mm}:${ss}`
    }
    // Numeric string (fractions like "0.8854")
    const maybeNum = Number(raw)
    if (!Number.isNaN(maybeNum) && raw.toString().trim() !== '') {
      const totalSeconds = Math.round(maybeNum * 24 * 3600)
      const h = Math.floor(totalSeconds / 3600) % 24
      const m = Math.floor((totalSeconds % 3600) / 60)
      const s = totalSeconds % 60
      const hh = h.toString().padStart(2, '0')
      const mm = m.toString().padStart(2, '0')
      const ss = s.toString().padStart(2, '0')
      return `${hh}:${mm}:${ss}`
    }
    const parts = raw.toString().trim().split(':')
    if (parts.length < 2) return null
    const [hh, mm, ss] = parts
    const safeH = hh.padStart(2, '0')
    const safeM = mm.padStart(2, '0')
    const safeS = ss ? ss.padStart(2, '0') : '00'
    return `${safeH}:${safeM}:${safeS}`
  }

  const handleDeleteCalendar = async (scope: 'group' | 'championship') => {
    if (deleting) return
    if (scope === 'group' && !selectedGroupId) return
    if (scope === 'championship' && !selectedChampionshipId) return
    const confirmMsg = scope === 'group'
      ? 'Eliminare tutte le partite e gli eventi del girone selezionato?'
      : 'Eliminare tutte le partite e gli eventi di tutti i gironi del campionato selezionato?'
    if (!window.confirm(confirmMsg)) return

    setDeleting(scope)
    try {
      const groupIds = scope === 'group'
        ? [selectedGroupId!]
        : (championships.find((c) => c.id === selectedChampionshipId)?.championship_groups || []).map((g) => g.id)
      if (groupIds.length === 0) {
        toast.error('Nessun girone da cancellare')
        setDeleting(null)
        return
      }

      const { data: matchesData, error: mErr } = await supabase
        .from('championship_matches')
        .select('id, event_id')
        .in('championship_group_id', groupIds)

      if (mErr) throw mErr
      const matchIds = (matchesData || []).map((m) => m.id)
      const eventIds = (matchesData || []).map((m) => m.event_id).filter(Boolean)

      if (eventIds.length) {
        await supabase.from('event_teams').delete().in('event_id', eventIds as string[])
        await supabase.from('events').delete().in('id', eventIds as string[])
      }
      if (matchIds.length) {
        await supabase.from('championship_match_sets').delete().in('match_id', matchIds)
      }
      await supabase.from('championship_matches').delete().in('championship_group_id', groupIds)

      // Elimina associazioni squadre-girone
      await supabase.from('championship_group_teams').delete().in('championship_group_id', groupIds)

      if (scope === 'group') {
        // Elimina il girone stesso
        await supabase.from('championship_groups').delete().in('id', groupIds)
      }

      if (scope === 'championship') {
        // Elimina club teams creati per il campionato
        await supabase.from('championship_club_teams').delete().eq('championship_id', selectedChampionshipId!)
        // Elimina il campionato e i gironi residui
        await supabase.from('championship_groups').delete().in('id', groupIds)
        await supabase.from('championships').delete().eq('id', selectedChampionshipId!)
        setSelectedChampionshipId(null)
        setSelectedGroupId(null)
      }

      toast.success('Calendario eliminato')
      await loadChampionships()
      if (scope === 'group' && selectedGroupId) {
        setSelectedGroupId(null)
        await loadGroupDetails('')
      }
    } catch (err) {
      console.error('Errore eliminazione calendario', err)
      toast.error('Impossibile eliminare il calendario')
    } finally {
      setDeleting(null)
    }
  }

  const initGroupTeamsSelection = (groupId: string | null) => {
    if (!groupId) return
    const group = currentGroups.find((g) => g.id === groupId)
    const map: Record<string, { selected: boolean; is_home_club: boolean }> = {}
    group?.championship_group_teams?.forEach((t) => {
      map[t.championship_club_team_id] = { selected: true, is_home_club: !!(t.is_home_club || t.championship_club_teams?.is_home_club) }
    })
    setGroupTeamsSelection(map)
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Campionati</CardTitle>
            <CardMeta>Seleziona o crea un campionato, importa il calendario, gestisci risultati e classifica</CardMeta>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select
              value={selectedChampionshipId || ''}
              onChange={(e) => setSelectedChampionshipId(e.target.value || null)}
            >
              {championships.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.sport} {c.status === 'published' ? '· Pubblicato' : ''}
                </option>
              ))}
            </Select>
            <Select
              value={selectedGroupId || ''}
              onChange={(e) => {
                const val = e.target.value
                setSelectedGroupId(val || null)
                setImportGroupId(val || null)
                initGroupTeamsSelection(val || null)
              }}
              disabled={!currentGroups.length}
            >
              {currentGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} · {g.phase}
                </option>
              ))}
            </Select>
            {mode !== 'athlete' && (
              <Button variant="outline" onClick={() => setShowGroupModal(true)} disabled={!selectedChampionshipId || mode === 'coach'}>
                Aggiungi girone
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                if (!selectedGroupId) return
                setImportGroupId(selectedGroupId)
                setShowImportModal(true)
              }}
              disabled={!selectedGroupId || mode === 'athlete'}
            >
              Importa calendario
            </Button>
            {mode !== 'athlete' && (
              <Button variant="outline" onClick={() => { setShowTeamsModal(true); initGroupTeamsSelection(selectedGroupId) }} disabled={!selectedGroupId}>
                Gestisci squadre
              </Button>
            )}
            {mode !== 'athlete' && (
              <Button variant="outline" onClick={() => handleDeleteCalendar('group')} disabled={!selectedGroupId || deleting !== null}>
                {deleting === 'group' ? 'Eliminazione...' : 'Elimina calendario girone'}
              </Button>
            )}
            {mode === 'admin' && (
              <>
                <Button variant="danger" onClick={() => handleDeleteCalendar('championship')} disabled={!selectedChampionshipId || deleting !== null}>
                  {deleting === 'championship' ? 'Eliminazione...' : 'Elimina tutto il campionato'}
                </Button>
                <Button onClick={() => setShowCreateModal(true)}>Crea campionato</Button>
              </>
            )}
          </div>
        </div>
      </Card>

      <Card className="mt-4">
        <CardTitle>Info campionato</CardTitle>
        <div className="mt-2 text-sm text-slate-500">
          {selectedChampionship ? (
            <ul className="space-y-1">
              <li><strong>Nome:</strong> {selectedChampionship.name}</li>
              <li><strong>Sport:</strong> {selectedChampionship.sport}</li>
              <li><strong>Stato:</strong> {selectedChampionship.status}</li>
              <li><strong>Periodo:</strong> {formatDate(selectedChampionship.start_date)} - {formatDate(selectedChampionship.end_date)}</li>
              <li><strong>Gironi:</strong> {currentGroups.length}</li>
            </ul>
          ) : (
            <p>Nessun campionato selezionato</p>
          )}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3 mt-4">
        <div className="md:col-span-2">
          <Card>
            <CardTitle>Partite del girone</CardTitle>
            <CardMeta>Modifica risultati (coach/admin) e sincronizzazione eventi match</CardMeta>
            <div className="mt-4 overflow-x-auto">
              <Table compact className="min-w-full">
                <thead>
                  <tr>
                    <th>Giornata</th>
                    <th>Data/Ora</th>
                    <th>Partita</th>
                    {mode !== 'athlete' && <th>Stato</th>}
                    <th>Risultato</th>
                    <th>Set</th>
                    {mode !== 'athlete' && <th>Calendario</th>}
                    {mode !== 'athlete' && <th>Azioni</th>}
                  </tr>
                </thead>
                <tbody>
                  {matches.length === 0 && (
                    <tr>
                      <td colSpan={mode === 'athlete' ? 5 : 8} className="text-center text-slate-400 py-4">Nessuna partita</td>
                    </tr>
                  )}
                  {matches.map((m) => (
                    <tr key={m.id}>
                      <td>{m.match_day ?? '—'}</td>
                      <td>
                        {m.match_date ? new Date(m.match_date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) : '—'}{' '}
                        {m.start_time ? m.start_time.slice(0,5) : ''}
                      </td>
                      <td>
                        <div className="font-semibold">
                          {m.home_club_team?.name || clubTeamName(m.home_club_team_id)} vs {m.away_club_team?.name || clubTeamName(m.away_club_team_id)}
                        </div>
                        <div className="text-xs text-slate-500">{m.location_text || '—'}</div>
                      </td>
                      {mode !== 'athlete' && (
                        <td>
                          <Select
                            value={m.status}
                            onChange={(e) => changeStatus(m.id, e.target.value)}
                            disabled={statusUpdating === m.id || mode === 'coach' && !coachTeamIds.size}
                          >
                            {Object.entries(STATUS_LABEL).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </Select>
                        </td>
                      )}
                      <td className="font-semibold">{formatScore(m.championship_match_sets)}</td>
                      <td className="text-sm text-slate-600">{formatSetsDetail(m.championship_match_sets)}</td>
                      {mode !== 'athlete' && (
                        <td>
                          {m.event_id ? (
                            <span className="text-xs text-emerald-600 font-semibold">Sincronizzato</span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      )}
                      {mode !== 'athlete' && (
                        <td>
                          <TableActions className="gap-2">
                            <Button size="sm" variant="outline" onClick={() => openResultEditor(m)}>
                              Modifica risultato
                            </Button>
                          </TableActions>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            <Modal
              open={resultModalOpen}
              onOpenChange={(open) => {
                if (!open) {
                  setResultModalOpen(false)
                  setEditingMatchId(null)
                  setResultEditingMatch(null)
                  setResultInput('')
                }
              }}
              title="Modifica risultato"
              description={resultEditingMatch ? `${clubTeamName(resultEditingMatch.home_club_team_id)} vs ${clubTeamName(resultEditingMatch.away_club_team_id)}` : ''}
            >
              <div className="space-y-3">
                <p className="text-sm text-slate-500">Inserisci i set separati da virgola (es: 25-20, 25-21, 28-26)</p>
                <Input
                  placeholder="25-20, 25-21, 28-26"
                  value={resultInput}
                  onChange={(e) => setResultInput(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => {
                    setResultModalOpen(false)
                    setEditingMatchId(null)
                    setResultEditingMatch(null)
                    setResultInput('')
                  }}>Annulla</Button>
                  <Button onClick={saveResult} disabled={savingResult}>
                    {savingResult ? 'Salvataggio...' : 'Salva'}
                  </Button>
                </div>
              </div>
            </Modal>
          </Card>
        </div>

        <div>
          <Card>
            <CardTitle>Classifica</CardTitle>
            <div className="overflow-x-auto">
              <Table compact>
                <thead>
                  <tr>
                    <th>Squadra</th>
                    <th>Pts</th>
                    <th>G</th>
                    <th>V</th>
                    <th>P</th>
                    <th>Set</th>
                    <th>Punti</th>
                  </tr>
                </thead>
                <tbody>
                  {standingsWithNames.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center text-slate-400 py-4">Nessun dato</td>
                    </tr>
                  )}
                  {standingsWithNames
                    .sort((a, b) => b.class_points - a.class_points || (b.set_ratio || 0) - (a.set_ratio || 0))
                    .map((row) => (
                      <tr key={row.club_team_id}>
                        <td>{row.team_name}</td>
                        <td>{row.class_points}</td>
                        <td>{row.matches_played}</td>
                        <td>{row.wins}</td>
                        <td>{row.losses}</td>
                        <td>{row.sets_for}-{row.sets_against}</td>
                        <td>{row.points_for}-{row.points_against}</td>
                      </tr>
                    ))}
                </tbody>
              </Table>
            </div>
          </Card>
        </div>
      </div>

      {loading && (
        <div className="text-center text-slate-500">Caricamento...</div>
      )}

      {mode === 'admin' && (
        <Modal
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
          title="Crea campionato"
          description="Definisci i dati base e (opzionale) crea il primo girone."
          size="lg"
        >
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="cs-label">Nome *</label>
                <Input
                  value={createForm.name}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Serie C Femminile"
                />
              </div>
              <div>
                <label className="cs-label">Sport</label>
                <Select
                  value={createForm.sport}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, sport: e.target.value }))}
                >
                  <option value="volleyball">Pallavolo</option>
                </Select>
              </div>
              <div>
                <label className="cs-label">Stagione *</label>
                <Select
                  value={createForm.season_id}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, season_id: e.target.value }))}
                >
                  {seasons.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="cs-label">Attività (opz.)</label>
                <Select
                  value={createForm.activity_id}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, activity_id: e.target.value }))}
                >
                  <option value="">Nessuna</option>
                  {activities.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="cs-label">Stato</label>
                <Select
                  value={createForm.status}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, status: e.target.value }))}
                >
                  <option value="draft">Bozza</option>
                  <option value="published">Pubblicato</option>
                  <option value="archived">Archiviato</option>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="cs-label">Inizio</label>
                  <Input
                    type="date"
                    value={createForm.start_date}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="cs-label">Fine</label>
                  <Input
                    type="date"
                    value={createForm.end_date}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-md border border-slate-200 p-3 bg-slate-50">
              <label className="cs-label">Crea subito un girone</label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={createForm.create_group}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, create_group: e.target.checked }))}
                  />
                  Crea girone
                </label>
                <Input
                  value={createForm.group_name}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, group_name: e.target.value }))}
                  disabled={!createForm.create_group}
                  placeholder="Girone A"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Annulla</Button>
              <Button onClick={handleCreateChampionship} disabled={savingResult}>
                {savingResult ? 'Salvataggio...' : 'Crea campionato'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal nuovo girone */}
      {mode !== 'athlete' && (
        <Modal
          open={showGroupModal}
          onOpenChange={setShowGroupModal}
          title="Aggiungi girone"
          description="Crea un nuovo girone per il campionato selezionato."
        >
          <div className="space-y-3">
            <div>
              <label className="cs-label">Nome</label>
              <Input
                value={groupForm.name}
                onChange={(e) => setGroupForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Girone B"
              />
            </div>
            <div>
              <label className="cs-label">Fase</label>
              <Select
                value={groupForm.phase}
                onChange={(e) => setGroupForm((prev) => ({ ...prev, phase: e.target.value }))}
              >
                <option value="regular">Regular</option>
                <option value="playoff">Playoff</option>
                <option value="playout">Playout</option>
                <option value="cup">Coppa</option>
                <option value="friendly">Amichevole</option>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowGroupModal(false)}>Annulla</Button>
              <Button onClick={handleCreateGroup} disabled={savingResult}>
                {savingResult ? 'Salvataggio...' : 'Crea girone'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal import calendario */}
      <Modal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        title="Importa calendario (Excel)"
        description="Colonne attese: giornata, data (YYYY-MM-DD), ora (HH:MM), casa, casa_nome, ospiti, ospiti_nome, luogo, note."
      >
        <div className="space-y-3">
          <div>
            <label className="cs-label">Girone</label>
            <Select
              value={importGroupId || ''}
              onChange={(e) => setImportGroupId(e.target.value || null)}
            >
              {currentGroups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="cs-label">File Excel</label>
            <Input type="file" accept=".xlsx,.xls" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
          </div>
          <div className="text-sm text-slate-600">
            Usa i codici squadra presenti in anagrafica (colonna "code"). Le partite saranno sincronizzate con il calendario per le squadre CSRoma.
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowImportModal(false)}>Annulla</Button>
            <Button onClick={handleImportMatches} disabled={importing || mode === 'athlete'}>
              {importing ? 'Importazione...' : 'Importa calendario'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal gestione squadre girone */}
      {mode !== 'athlete' && (
        <Modal
          open={showTeamsModal}
          onOpenChange={setShowTeamsModal}
          title="Squadre del girone"
          description="Seleziona le squadre che partecipano al girone e indica quelle CSRoma."
          size="lg"
        >
          <div className="space-y-3">
            <div>
              <label className="cs-label">Filtra squadre</label>
              <Input
                placeholder="Cerca per nome o codice"
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
              />
            </div>
            <div className="max-h-72 overflow-y-auto rounded border border-slate-200 divide-y divide-slate-100">
              {clubTeams
                .filter((t) => {
                  const term = teamSearch.toLowerCase()
                  return !term || t.name.toLowerCase().includes(term) || (t.code || '').toLowerCase().includes(term)
                })
                .map((t) => {
                  const state = groupTeamsSelection[t.id] || { selected: false, is_home_club: t.is_home_club }
                  return (
                    <div key={t.id} className="flex items-center justify-between px-3 py-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={state.selected}
                          onChange={(e) => {
                            const selected = e.target.checked
                            setGroupTeamsSelection((prev) => ({
                              ...prev,
                              [t.id]: { selected, is_home_club: selected ? state.is_home_club : false }
                            }))
                          }}
                        />
                        <div>
                          <div className="font-medium">{t.name}</div>
                          <div className="text-xs text-slate-500">{t.code || 'Nessun codice'}</div>
                        </div>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-emerald-700">
                        <input
                          type="checkbox"
                          checked={state.is_home_club}
                          disabled={!state.selected}
                          onChange={(e) => {
                            const flag = e.target.checked
                            setGroupTeamsSelection((prev) => ({
                              ...prev,
                              [t.id]: { selected: true, is_home_club: flag }
                            }))
                          }}
                        />
                        CSRoma
                      </label>
                    </div>
                  )
                })}
            </div>
            <div className="space-y-2 rounded-md border border-slate-200 p-3">
              <div className="font-medium">Aggiungi nuova squadra campionato</div>
              <div className="grid gap-2 md:grid-cols-4">
                <Input
                  placeholder="Codice"
                  value={newClubTeam.code}
                  onChange={(e) => setNewClubTeam((prev) => ({ ...prev, code: e.target.value }))}
                />
                <Input
                  placeholder="Nome"
                  value={newClubTeam.name}
                  onChange={(e) => setNewClubTeam((prev) => ({ ...prev, name: e.target.value }))}
                />
                <Select
                  value={newClubTeam.team_id}
                  onChange={(e) => setNewClubTeam((prev) => ({ ...prev, team_id: e.target.value }))}
                >
                  <option value="">Avversario (nessun link)</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}{t.code ? ` (${t.code})` : ''}</option>
                  ))}
                </Select>
                <label className="flex items-center gap-2 text-sm text-emerald-700">
                  <input
                    type="checkbox"
                    checked={newClubTeam.is_home_club}
                    onChange={(e) => setNewClubTeam((prev) => ({ ...prev, is_home_club: e.target.checked }))}
                  />
                  CSRoma
                </label>
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={async () => {
                  if (!selectedChampionshipId) {
                    toast.error('Seleziona un campionato')
                    return
                  }
                  if (!newClubTeam.code || !newClubTeam.name) {
                    toast.error('Codice e nome sono obbligatori')
                    return
                  }
                  try {
                    const payload = {
                      championship_id: selectedChampionshipId,
                      code: newClubTeam.code.trim().toUpperCase(),
                      name: newClubTeam.name.trim(),
                      is_home_club: newClubTeam.is_home_club || !!newClubTeam.team_id,
                      team_id: newClubTeam.team_id || null
                    }
                    const { data, error } = await supabase
                      .from('championship_club_teams')
                      .upsert(payload, { onConflict: 'championship_id,code' })
                      .select('id')
                      .single()
                    if (error) throw error
                    toast.success('Squadra aggiunta')
                    setNewClubTeam({ code: '', name: '', is_home_club: false, team_id: '' })
                    await loadClubTeams(selectedChampionshipId)
                    initGroupTeamsSelection(selectedGroupId)
                  } catch (err) {
                    console.error('Errore creazione squadra campionato', err)
                    toast.error('Impossibile creare la squadra')
                  }
                }}>
                  Aggiungi squadra
                </Button>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowTeamsModal(false)}>Annulla</Button>
              <Button onClick={async () => {
                if (!selectedGroupId) {
                  toast.error('Seleziona un girone')
                  return
                }
                setGroupTeamsSaving(true)
                try {
                  const current = currentGroups.find((g) => g.id === selectedGroupId)?.championship_group_teams || []
                  const currentIds = new Set(current.map((t) => t.championship_club_team_id))
                  const selectedEntries = Object.entries(groupTeamsSelection).filter(([, v]) => v.selected)
                  const selectedIds = new Set(selectedEntries.map(([id]) => id))
                  const toUpsert = selectedEntries.map(([clubTeamId, v]) => ({
                    championship_group_id: selectedGroupId,
                    championship_club_team_id: clubTeamId,
                    is_home_club: v.is_home_club
                  }))
                  const toDelete = Array.from(currentIds).filter((id) => !selectedIds.has(id))

                  if (toUpsert.length > 0) {
                    const { error } = await supabase
                      .from('championship_group_teams')
                      .upsert(toUpsert, { onConflict: 'championship_group_id,championship_club_team_id' })
                    if (error) throw error
                  }

                  if (toDelete.length > 0) {
                    const { error } = await supabase
                      .from('championship_group_teams')
                      .delete()
                      .eq('championship_group_id', selectedGroupId)
                      .in('championship_club_team_id', toDelete)
                    if (error) throw error
                  }

                  toast.success('Squadre aggiornate')
                  setShowTeamsModal(false)
                  await loadChampionships()
                  if (selectedGroupId) await loadGroupDetails(selectedGroupId)
                } catch (err) {
                  console.error('Errore aggiornamento squadre', err)
                  toast.error('Impossibile aggiornare le squadre')
                } finally {
                  setGroupTeamsSaving(false)
                }
              }} disabled={groupTeamsSaving}>
                {groupTeamsSaving ? 'Salvataggio...' : 'Salva squadre'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
