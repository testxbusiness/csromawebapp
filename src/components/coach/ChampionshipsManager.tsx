'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardTitle, CardMeta, Table, TableActions, Button, Input, Select, toast, Modal } from '@/components/ui'
import { importFromExcel } from '@/lib/utils/excelImport'
import { CalendarDays, Clock3, MapPin, Plus, Trash2, Trophy, Upload, Users } from 'lucide-react'
import { CalendarSyncBadge, ChampionshipInfoPanel, ChampionshipToolbar, ConvocationPublishedList, EditableConvocationList, MatchStatusBadge, NextMatchPanel, StandingsPanel } from '@/components/championship/ChampionshipPanels'
import {
  firstRelation,
  STATUS_LABEL,
  type Activity,
  type Championship,
  type ClubTeam,
  type ClubTeamOption,
  type Convocation,
  type ConvocationMember,
  type GroupTeam,
  type ManagerMode,
  type Match,
  type Season,
  type Standing,
  type Team,
  type TeamMember,
} from '@/components/championship/types'
import { useChampionshipCatalog } from '@/components/championship/useChampionshipCatalog'
import { useChampionshipGroupDetails } from '@/components/championship/useChampionshipGroupDetails'
import { useChampionshipMatchMutations } from '@/components/championship/useChampionshipMatchMutations'
import { useImportedClubTeam } from '@/components/championship/useImportedClubTeam'
import { useChampionshipConvocations } from '@/components/championship/useChampionshipConvocations'
import { MatchInfoModal, MatchResultModal } from '@/components/championship/ChampionshipMatchModals'
import { formatChampionshipDate as formatDate, formatMatchScore as formatScore, formatMatchSetsDetail as formatSetsDetail, matchDateTime, normalizeChampionshipTime as normalizeTime, parseMatchResult } from '@/components/championship/formatters'
import { matchImportColumns, resultImportColumns } from '@/components/championship/importDefinitions'

export default function ChampionshipsManager() {
  let mode = 'coach' as ManagerMode
  const supabase = useMemo(() => createClient(), [])
  const [selectedChampionshipId, setSelectedChampionshipId] = useState<string | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [savingResult, setSavingResult] = useState(false)
  const [resultInput, setResultInput] = useState<string>('')
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showImportResultsModal, setShowImportResultsModal] = useState(false)
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
  const [importResultsGroupId, setImportResultsGroupId] = useState<string | null>(null)
  const [importResultsFile, setImportResultsFile] = useState<File | null>(null)
  const [importingResults, setImportingResults] = useState(false)
  const [groupTeamsSelection, setGroupTeamsSelection] = useState<Record<string, { selected: boolean; is_home_club: boolean }>>({})
  const [teamSearch, setTeamSearch] = useState('')
  const [groupTeamsSaving, setGroupTeamsSaving] = useState(false)
  const [clubTeams, setClubTeams] = useState<ClubTeamOption[]>([])
  const [newClubTeam, setNewClubTeam] = useState({ code: '', name: '', is_home_club: false, team_id: '' })
  const [deleting, setDeleting] = useState<'group'|'championship'|null>(null)
  const [resultModalOpen, setResultModalOpen] = useState(false)
  const [resultEditingMatch, setResultEditingMatch] = useState<Match | null>(null)
  const [infoModalOpen, setInfoModalOpen] = useState(false)
  const [infoEditingMatch, setInfoEditingMatch] = useState<Match | null>(null)
  const [infoForm, setInfoForm] = useState({ match_date: '', start_time: '', location_text: '' })
  const [coachTeamIds, setCoachTeamIds] = useState<Set<string>>(new Set())
  const [athleteTeamIds, setAthleteTeamIds] = useState<Set<string>>(new Set())
  const [nextMatch, setNextMatch] = useState<Match | null>(null)
  const [convocationModalOpen, setConvocationModalOpen] = useState(false)
  const [convocationClubTeamId, setConvocationClubTeamId] = useState<string | null>(null)
  const [convocationMatch, setConvocationMatch] = useState<Match | null>(null)

  const {
    championships,
    seasons,
    activities,
    teams,
    loading: catalogLoading,
    reload: reloadChampionships,
  } = useChampionshipCatalog({ mode, coachTeamIds, athleteTeamIds })
  const {
    matches,
    standings,
    loading: groupLoading,
    reload: reloadGroupDetails,
  } = useChampionshipGroupDetails(selectedGroupId)
  const loading = catalogLoading || groupLoading
  const {
    changeStatus,
    infoSaving,
    saveMatchInfo: persistMatchInfo,
    saveResult: persistResult,
    savingResult: savingMatchResult,
    statusUpdating,
  } = useChampionshipMatchMutations({ selectedGroupId, reloadGroupDetails })
  const { ensureClubTeam } = useImportedClubTeam({ championshipId: selectedChampionshipId, teams })
  const {
    convocation,
    convocationLoading,
    convocationSaving,
    convocationSelection,
    convocationTeamMembers,
    loadConvocationData,
    saveConvocation: persistConvocation,
    setConvocation,
    setConvocationSelection,
    setConvocationTeamMembers,
  } = useChampionshipConvocations()

  useEffect(() => {
    if (seasons[0] && !createForm.season_id) {
      setCreateForm((prev) => ({ ...prev, season_id: seasons[0].id }))
    }
  }, [createForm.season_id, seasons])

  // Allinea importGroupId al girone selezionato di default
  useEffect(() => {
    if (selectedGroupId) {
      setImportGroupId(selectedGroupId)
    }
  }, [selectedGroupId])

  useEffect(() => {
    if (selectedGroupId) {
      setImportResultsGroupId(selectedGroupId)
    }
  }, [selectedGroupId])

  useEffect(() => {
    computeNextMatch(matches)
  }, [matches, mode, coachTeamIds, athleteTeamIds]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadCoachTeams = useCallback(async () => {
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
  }, [supabase])

  const loadAthleteTeams = useCallback(async () => {
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
  }, [supabase])

  const loadClubTeams = useCallback(async (championshipId: string) => {
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
  }, [supabase])

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

  const clubTeamPlainName = (clubTeamId: string) => {
    return clubTeamName(clubTeamId).replace(/\s*\([^)]*\)\s*$/, '')
  }

  const openResultEditor = (match: Match) => {
    const orderedSets = (match.championship_match_sets || []).sort((a, b) => a.set_number - b.set_number)
    const prefill = orderedSets.map((s) => `${s.home_points}-${s.away_points}`).join(', ')
    setResultInput(prefill)
    setEditingMatchId(match.id)
    setResultEditingMatch(match)
    setResultModalOpen(true)
  }

  const openInfoEditor = (match: Match) => {
    setInfoEditingMatch(match)
    setInfoForm({
      match_date: match.match_date || '',
      start_time: match.start_time ? match.start_time.slice(0, 5) : '',
      location_text: match.location_text || ''
    })
    setInfoModalOpen(true)
  }

  const saveResult = () => {
    if (!editingMatchId) return
    void persistResult({
      matchId: editingMatchId,
      result: resultInput,
      onSuccess: () => {
        setEditingMatchId(null)
        setResultEditingMatch(null)
        setResultModalOpen(false)
        setResultInput('')
      },
    })
  }

  const saveMatchInfo = () => {
    if (!infoEditingMatch) return
    void persistMatchInfo({
      matchId: infoEditingMatch.id,
      matchDate: infoForm.match_date,
      startTime: infoForm.start_time,
      locationText: infoForm.location_text,
      onSuccess: () => {
        setInfoModalOpen(false)
        setInfoEditingMatch(null)
      },
    })
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
      await reloadChampionships()
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
      await reloadChampionships()
    } catch (err) {
      console.error('Errore creazione girone', err)
      toast.error('Impossibile creare il girone')
    } finally {
      setSavingResult(false)
    }
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

      const clubByCode = new Map<string, ClubTeamOption>()
      clubTeams.forEach((ct) => { clubByCode.set(ct.code.trim().toUpperCase(), ct) })

      const rows = result.data
      const payload: any[] = []
      const groupClubTeams: Set<string> = new Set()

      for (const row of rows) {
        const homeId = await ensureClubTeam({ codeRaw: row.casa, nameHint: row.casa_nome, clubByCode })
        const awayId = await ensureClubTeam({ codeRaw: row.ospiti, nameHint: row.ospiti_nome, clubByCode })
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
      await reloadGroupDetails()
    } catch (err) {
      console.error('Errore import calendario', err)
      toast.error('Impossibile importare il calendario')
    } finally {
      setImporting(false)
    }
  }

  const handleImportResults = async () => {
    const groupId = importResultsGroupId || selectedGroupId
    if (!groupId) {
      toast.error('Seleziona un girone')
      return
    }
    if (!importResultsFile) {
      toast.error('Seleziona un file Excel')
      return
    }

    setImportingResults(true)
    try {
      const result = await importFromExcel<{
        giornata?: number
        casa: string
        ospiti: string
        risultato_set?: string
        risultato?: string
      }>(importResultsFile, resultImportColumns, { skipFirstRow: true })

      if (!result.success || result.validRows === 0) {
        toast.error(result.errors.join(', ') || 'File non valido')
        setImportingResults(false)
        return
      }

      const { data: matchesData, error: matchesError } = await supabase
        .from('championship_matches')
        .select('id, match_day, home_club_team_id, away_club_team_id')
        .eq('championship_group_id', groupId)

      if (matchesError) throw matchesError

      const clubByCode = new Map<string, ClubTeamOption>()
      clubTeams.forEach((ct) => { clubByCode.set(ct.code.trim().toUpperCase(), ct) })

      const matchMap = new Map<string, string>()
      ;(matchesData || []).forEach((m: any) => {
        const key = `${m.match_day ?? ''}|${m.home_club_team_id}|${m.away_club_team_id}`
        matchMap.set(key, m.id)
      })

      const errors: string[] = []
      const updates: { matchId: string; sets: { home: number; away: number }[] }[] = []

      for (const row of result.data) {
        const giornata = row.giornata ?? null
        if (!giornata) {
          errors.push('Giornata mancante')
          continue
        }
        const homeCode = row.casa?.trim().toUpperCase()
        const awayCode = row.ospiti?.trim().toUpperCase()
        if (!homeCode || !awayCode) {
          errors.push(`Codici squadra mancanti per giornata ${giornata}`)
          continue
        }
        const homeClub = clubByCode.get(homeCode)
        const awayClub = clubByCode.get(awayCode)
        if (!homeClub || !awayClub) {
          errors.push(`Squadre non trovate (${homeCode} vs ${awayCode})`)
          continue
        }
        const key = `${giornata}|${homeClub.id}|${awayClub.id}`
        const matchId = matchMap.get(key)
        if (!matchId) {
          errors.push(`Partita non trovata (G${giornata} ${homeCode} vs ${awayCode})`)
          continue
        }

        const resultString = row.risultato_set || row.risultato || ''
        if (!resultString.trim()) {
          errors.push(`Risultato mancante (G${giornata} ${homeCode} vs ${awayCode})`)
          continue
        }

        try {
          const sets = parseMatchResult(resultString)
          updates.push({ matchId, sets })
        } catch (err: any) {
          errors.push(`Risultato non valido (G${giornata} ${homeCode} vs ${awayCode}): ${err.message || 'errore'}`)
        }
      }

      let updated = 0
      for (const item of updates) {
        await supabase.from('championship_match_sets').delete().eq('match_id', item.matchId)
        if (item.sets.length > 0) {
          const payload = item.sets.map((s, idx) => ({
            match_id: item.matchId,
            set_number: idx + 1,
            home_points: s.home,
            away_points: s.away
          }))
          const { error: insertError } = await supabase.from('championship_match_sets').insert(payload)
          if (insertError) throw insertError
        }
        const { error: statusError } = await supabase
          .from('championship_matches')
          .update({ status: item.sets.length > 0 ? 'completed' : 'scheduled' })
          .eq('id', item.matchId)
        if (statusError) throw statusError
        updated += 1
      }

      if (errors.length > 0) {
        console.error('Errori import risultati:', errors)
        toast.error(`Import completato con ${errors.length} errori`)
      }
      if (updated > 0) {
        toast.success(`Aggiornate ${updated} partite`)
      }

      setShowImportResultsModal(false)
      setImportResultsFile(null)
      await reloadGroupDetails()
    } catch (err) {
      console.error('Errore import risultati', err)
      toast.error('Impossibile importare i risultati')
    } finally {
      setImportingResults(false)
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
  const sortedStandings = [...standingsWithNames]
    .sort((a, b) => b.class_points - a.class_points || (b.set_ratio || 0) - (a.set_ratio || 0))
  const convocationCSRTeams = convocationMatch ? matchCSRClubTeams(convocationMatch) : []
  const convocationClubTeam = convocationCSRTeams.find(({ clubTeam }) => clubTeam.id === convocationClubTeamId)?.clubTeam || null
  const canEditConvocation = mode === 'admin' || (mode === 'coach' && !!(convocationClubTeam?.team_id && coachTeamIds.has(convocationClubTeam.team_id)))

  function isCSRClubTeam(club?: ClubTeam | null) {
    return !!(club?.is_home_club || club?.team_id)
  }

  function matchCSRClubTeams(m: Match) {
    const home = m.home_club_team || clubTeams.find((c) => c.id === m.home_club_team_id)
    const away = m.away_club_team || clubTeams.find((c) => c.id === m.away_club_team_id)
    const csr: { clubTeam: ClubTeam; side: 'home' | 'away' }[] = []
    if (home && isCSRClubTeam(home)) csr.push({ clubTeam: home, side: 'home' })
    if (away && isCSRClubTeam(away)) csr.push({ clubTeam: away, side: 'away' })
    return csr
  }

  const matchVisibleForRole = (m: Match) => {
    const csrTeams = matchCSRClubTeams(m)
    if (csrTeams.length === 0) return false
    if (mode === 'admin') return true
    if (mode === 'coach') {
      return csrTeams.some(({ clubTeam }) => clubTeam.team_id && coachTeamIds.has(clubTeam.team_id))
    }
    if (mode === 'athlete') {
      return csrTeams.some(({ clubTeam }) => clubTeam.team_id && athleteTeamIds.has(clubTeam.team_id))
    }
    return false
  }

  const computeNextMatch = (input: Match[]) => {
    const now = new Date()
    const filtered = input.filter((m) => m.status === 'scheduled' && matchVisibleForRole(m))
    const upcoming = filtered
      .map((m) => ({ match: m, date: matchDateTime(m) }))
      .filter((item) => item.date && item.date.getTime() >= now.getTime())
      .sort((a, b) => (a.date!.getTime() - b.date!.getTime()))
    setNextMatch(upcoming.length ? upcoming[0].match : null)
  }

  const pickUserClubTeamForMatch = (m: Match) => {
    const csrTeams = matchCSRClubTeams(m)
    if (mode === 'admin') return csrTeams[0]?.clubTeam || null
    if (mode === 'coach') {
      return csrTeams.find(({ clubTeam }) => clubTeam.team_id && coachTeamIds.has(clubTeam.team_id))?.clubTeam || null
    }
    if (mode === 'athlete') {
      return csrTeams.find(({ clubTeam }) => clubTeam.team_id && athleteTeamIds.has(clubTeam.team_id))?.clubTeam || null
    }
    return null
  }

  const openConvocationModal = async (m: Match) => {
    const candidate = pickUserClubTeamForMatch(m)
    const csrTeams = matchCSRClubTeams(m)
    const fallback = candidate || csrTeams[0]?.clubTeam || null
    const clubTeamId = fallback?.id || null
    setConvocationClubTeamId(clubTeamId)
    setConvocationMatch(m)
    setConvocationSelection(new Set())
    setConvocation(null)
    setConvocationTeamMembers([])
    setConvocationModalOpen(true)
    if (clubTeamId) {
      await loadConvocationData(m, clubTeamId, fallback?.team_id || null)
    }
  }

  const saveConvocation = () => {
    if (!convocationMatch || !convocationClubTeamId) return
    const match = convocationMatch
    const csrTeam = matchCSRClubTeams(match).find(({ clubTeam }) => clubTeam.id === convocationClubTeamId)?.clubTeam
    const teamId = csrTeam?.team_id || null
    if (!teamId) {
      toast.error('Seleziona una squadra CSRoma')
      return
    }
    void persistConvocation({ match, clubTeamId: convocationClubTeamId, teamId })
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
      await reloadChampionships()
      if (scope === 'group' && selectedGroupId) {
        setSelectedGroupId(null)
        await reloadGroupDetails()
      }
    } catch (err) {
      console.error('Errore eliminazione calendario', err)
      toast.error('Impossibile eliminare il calendario')
    } finally {
      setDeleting(null)
    }
  }

  const initGroupTeamsSelection = useCallback((groupId: string | null) => {
    if (!groupId) return
    const group = currentGroups.find((g) => g.id === groupId)
    const map: Record<string, { selected: boolean; is_home_club: boolean }> = {}
    group?.championship_group_teams?.forEach((t) => {
      map[t.championship_club_team_id] = { selected: true, is_home_club: !!(t.is_home_club || t.championship_club_teams?.is_home_club) }
    })
    setGroupTeamsSelection(map)
  }, [currentGroups])

  useEffect(() => {
    if (mode === 'coach') void loadCoachTeams()
    else if (mode === 'athlete') void loadAthleteTeams()
  }, [loadAthleteTeams, loadCoachTeams, mode])

  useEffect(() => {
    if (selectedChampionshipId) void loadClubTeams(selectedChampionshipId)
    else setClubTeams([])
  }, [loadClubTeams, selectedChampionshipId])

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
  }, [championships, initGroupTeamsSelection, selectedChampionshipId])

  return (
    <div className="space-y-6">
      <Card variant="primary" className="overflow-hidden">
        <div className="flex flex-col gap-5">
          <div>
            <CardTitle className="text-lg sm:text-xl">Campionati</CardTitle>
            <CardMeta>Vista operativa per coach: risultati, info gara, convocazioni e monitoraggio del girone.</CardMeta>
          </div>
          <ChampionshipToolbar
            championshipSelect={(
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
            )}
            groupSelect={(
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
            )}
            actions={(
              <>
                {mode !== 'athlete' && (
                  <Button size="icon" variant="outline" title="Aggiungi girone" aria-label="Aggiungi girone" onClick={() => setShowGroupModal(true)} disabled={!selectedChampionshipId}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="icon"
                  title="Importa calendario"
                  aria-label="Importa calendario"
                  onClick={() => {
                    if (!selectedGroupId) return
                    setImportGroupId(selectedGroupId)
                    setShowImportModal(true)
                  }}
                  disabled={!selectedGroupId || mode === 'athlete'}
                >
                  <Upload className="h-4 w-4" aria-hidden="true" />
                </Button>
                {mode !== 'athlete' && (
                  <Button
                    variant="outline"
                    size="icon"
                    title="Importa risultati"
                    aria-label="Importa risultati"
                    onClick={() => {
                      if (!selectedGroupId) return
                      setImportResultsGroupId(selectedGroupId)
                      setShowImportResultsModal(true)
                    }}
                    disabled={!selectedGroupId}
                  >
                    <Upload className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
                {mode !== 'athlete' && (
                  <Button size="icon" variant="outline" title="Gestisci squadre" aria-label="Gestisci squadre" onClick={() => { setShowTeamsModal(true); initGroupTeamsSelection(selectedGroupId) }} disabled={!selectedGroupId}>
                    <Users className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
                {mode !== 'athlete' && (
                  <Button size="icon" variant="outline" title="Elimina calendario girone" aria-label="Elimina calendario girone" onClick={() => handleDeleteCalendar('group')} disabled={!selectedGroupId || deleting !== null}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
                {mode !== 'athlete' && (
                  <>
                    <Button size="icon" variant="danger" title="Elimina tutto il campionato" aria-label="Elimina tutto il campionato" onClick={() => handleDeleteCalendar('championship')} disabled={!selectedChampionshipId || deleting !== null}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button size="icon" title="Crea campionato" aria-label="Crea campionato" onClick={() => setShowCreateModal(true)}>
                      <Trophy className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </>
                )}
              </>
            )}
          />
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 text-sm font-medium text-slate-700">
              <Trophy className="h-4 w-4 text-[color:var(--cs-primary)]" aria-hidden="true" />
              {selectedChampionship ? selectedChampionship.name : 'Nessun campionato selezionato'}
            </div>
            <div className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 text-sm font-medium text-slate-700">
              <Users className="h-4 w-4 text-[color:var(--cs-accent)]" aria-hidden="true" />
              {currentGroups.length} {currentGroups.length === 1 ? 'girone attivo' : 'gironi attivi'}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 mt-4">
        <ChampionshipInfoPanel
          description="Stato del campionato e perimetro del girone selezionato."
          items={selectedChampionship ? [
            { label: 'Nome', value: selectedChampionship.name },
            { label: 'Sport e stato', value: `${selectedChampionship.sport} · ${selectedChampionship.status}` },
            { label: 'Periodo', value: `${formatDate(selectedChampionship.start_date)} - ${formatDate(selectedChampionship.end_date)}` },
            { label: 'Gironi', value: String(currentGroups.length) },
          ] : null}
          emptyText="Nessun campionato selezionato"
        />

        <NextMatchPanel
          empty={!nextMatch}
          matchDateLabel={nextMatch ? `${nextMatch.match_date ? new Date(nextMatch.match_date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}${nextMatch.start_time ? ` · ${nextMatch.start_time.slice(0, 5)}` : ''}` : ''}
          roundLabel={nextMatch?.match_day ? `Giornata ${nextMatch.match_day}` : 'Turno da definire'}
          matchupLabel={nextMatch ? `${clubTeamPlainName(nextMatch.home_club_team_id)} vs ${clubTeamPlainName(nextMatch.away_club_team_id)}` : ''}
          locationLabel={nextMatch?.location_text || 'Luogo da definire'}
          helperText="Apri la convocazione e aggiorna subito la rosa della gara."
          onOpenConvocations={() => nextMatch && openConvocationModal(nextMatch)}
          emptyText="Nessuna prossima partita CSRoma"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3 mt-4">
        <div className="md:col-span-2">
          <Card variant="primary">
            <CardTitle>Partite del girone</CardTitle>
            <CardMeta>Modifica risultati (coach/admin) e sincronizzazione eventi match</CardMeta>
            <div className="mt-4 overflow-x-auto hidden md:block">
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
                          <CalendarSyncBadge synced={!!m.event_id} />
                        </td>
                      )}
                    {mode !== 'athlete' && (
                      <td>
                        <TableActions className="gap-2">
                          <Button size="sm" variant="outline" onClick={() => openResultEditor(m)}>
                            Modifica risultato
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openInfoEditor(m)}>
                            Modifica info gara
                          </Button>
                        </TableActions>
                      </td>
                    )}
                  </tr>
                ))}
                </tbody>
              </Table>
            </div>
            <div className="mt-4 space-y-3 md:hidden">
              {matches.length === 0 && (
                <div className="rounded-lg border border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
                  Nessuna partita
                </div>
              )}
              {matches.map((m) => (
                <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {m.match_day ? `Giornata ${m.match_day}` : 'Giornata da definire'}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {m.match_date ? new Date(m.match_date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) : '—'}
                        {m.start_time ? ` · ${m.start_time.slice(0,5)}` : ''}
                      </div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                      {formatScore(m.championship_match_sets)}
                    </span>
                  </div>
                  <div className="mt-3 text-sm font-semibold text-slate-900">
                    {m.home_club_team?.name || clubTeamName(m.home_club_team_id)}
                  </div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">vs</div>
                  <div className="text-sm font-semibold text-slate-900">
                    {m.away_club_team?.name || clubTeamName(m.away_club_team_id)}
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-slate-600">
                    <div><span className="font-medium text-slate-700">Set:</span> {formatSetsDetail(m.championship_match_sets) || '—'}</div>
                    <div><span className="font-medium text-slate-700">Luogo:</span> {m.location_text || '—'}</div>
                    <div className="flex items-center justify-between gap-3"><span className="font-medium text-slate-700">Stato</span><MatchStatusBadge status={m.status} label={STATUS_LABEL[m.status] || m.status} /></div>
                    <div className="flex items-center justify-between gap-3"><span className="font-medium text-slate-700">Calendario</span><CalendarSyncBadge synced={!!m.event_id} /></div>
                  </div>
                  <div className="mt-4 flex flex-col gap-2">
                    <Button size="sm" variant="outline" block onClick={() => openResultEditor(m)}>
                      Modifica risultato
                    </Button>
                    <Button size="sm" variant="outline" block onClick={() => openInfoEditor(m)}>
                      Modifica info gara
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <MatchResultModal
              open={resultModalOpen}
              description={resultEditingMatch ? `${clubTeamName(resultEditingMatch.home_club_team_id)} vs ${clubTeamName(resultEditingMatch.away_club_team_id)}` : ''}
              value={resultInput}
              saving={savingMatchResult}
              onOpenChange={(open) => { if (!open) { setResultModalOpen(false); setEditingMatchId(null); setResultEditingMatch(null); setResultInput('') } }}
              onChange={setResultInput}
              onCancel={() => { setResultModalOpen(false); setEditingMatchId(null); setResultEditingMatch(null); setResultInput('') }}
              onSave={saveResult}
            />
            <MatchInfoModal
              open={infoModalOpen}
              description={infoEditingMatch ? `${clubTeamName(infoEditingMatch.home_club_team_id)} vs ${clubTeamName(infoEditingMatch.away_club_team_id)}` : ''}
              form={infoForm}
              saving={infoSaving}
              onOpenChange={(open) => { if (!open) { setInfoModalOpen(false); setInfoEditingMatch(null) } }}
              onChange={setInfoForm}
              onCancel={() => setInfoModalOpen(false)}
              onSave={saveMatchInfo}
            />
          </Card>
        </div>

        <div>
          <StandingsPanel rows={sortedStandings} />
        </div>
      </div>

      <Modal
        fullscreenOnMobile
        open={convocationModalOpen}
        onOpenChange={(open) => {
          setConvocationModalOpen(open)
          if (!open) {
            setConvocation(null)
            setConvocationSelection(new Set())
            setConvocationTeamMembers([])
            setConvocationClubTeamId(null)
            setConvocationMatch(null)
          }
        }}
        title="Convocazioni"
        description={convocationMatch ? `${clubTeamPlainName(convocationMatch.home_club_team_id)} vs ${clubTeamPlainName(convocationMatch.away_club_team_id)}` : ''}
      >
        {!convocationMatch && <div className="text-sm text-slate-500">Seleziona una partita</div>}
        {convocationMatch && (
          <div className="space-y-4">
            {convocationCSRTeams.length > 1 && (
              <div>
                <label className="cs-label">Squadra CSR da convocare</label>
                <Select
                  value={convocationClubTeamId || ''}
                  onChange={async (e) => {
                    const id = e.target.value
                    setConvocationClubTeamId(id || null)
                    setConvocationSelection(new Set())
                    setConvocation(null)
                    const chosen = convocationCSRTeams.find(({ clubTeam }) => clubTeam.id === id)?.clubTeam
                    if (id && convocationMatch) {
                      await loadConvocationData(convocationMatch, id, chosen?.team_id || null)
                    }
                  }}
                >
                  {convocationCSRTeams.map(({ clubTeam }) => (
                    <option key={clubTeam.id} value={clubTeam.id}>
                      {clubTeam.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div className="text-sm text-slate-600">
              {convocationClubTeam
                ? `Rosa: ${convocationClubTeam.name}`
                : 'Seleziona una squadra CSRoma'}
            </div>

            {convocationLoading && (
              <div className="text-sm text-slate-500">Caricamento convocazioni...</div>
            )}

            {!convocationLoading && mode === 'athlete' && (
              <>
                <ConvocationPublishedList
                  members={(convocation?.championship_match_convocation_members || []).map((cm) => {
                    const labelFromProfile = cm.profiles?.first_name || cm.profiles?.last_name
                      ? `${cm.profiles?.first_name || ''} ${cm.profiles?.last_name || ''}`.trim()
                      : ''
                    const labelFromTMProfile = cm.team_members?.profiles?.first_name || cm.team_members?.profiles?.last_name
                      ? `${cm.team_members?.profiles?.first_name || ''} ${cm.team_members?.profiles?.last_name || ''}`.trim()
                      : ''
                    const label = labelFromProfile || labelFromTMProfile || 'Atleta'
                    return {
                      id: cm.team_member_id,
                      label,
                      jerseyNumber: cm.team_members?.jersey_number ? `#${cm.team_members.jersey_number}` : undefined,
                    }
                  })}
                  emptyText="Le convocazioni non sono ancora state pubblicate"
                />
              </>
            )}

            {!convocationLoading && mode !== 'athlete' && (
              <EditableConvocationList
                members={convocationTeamMembers.map((tm) => ({
                  id: tm.id,
                  label: tm.profiles ? `${tm.profiles.first_name || ''} ${tm.profiles.last_name || ''}`.trim() : tm.id,
                  jerseyNumber: tm.jersey_number ? `#${tm.jersey_number}` : undefined,
                  selected: convocationSelection.has(tm.id),
                }))}
                canEdit={canEditConvocation}
                onToggle={(memberId, checked) => {
                  setConvocationSelection((prev) => {
                    const next = new Set(prev)
                    if (checked) next.add(memberId)
                    else next.delete(memberId)
                    return next
                  })
                }}
              />
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConvocationModalOpen(false)}>Chiudi</Button>
              {mode !== 'athlete' && (
                <Button onClick={saveConvocation} disabled={!canEditConvocation || convocationSaving}>
                  {convocationSaving ? 'Salvataggio...' : 'Salva convocazioni'}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {loading && (
        <div className="text-center text-slate-500">Caricamento...</div>
      )}

      {mode !== 'athlete' && (
        <Modal
          fullscreenOnMobile
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
          fullscreenOnMobile
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
        fullscreenOnMobile
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

      {/* Modal import risultati */}
      <Modal
        fullscreenOnMobile
        open={showImportResultsModal}
        onOpenChange={setShowImportResultsModal}
        title="Importa risultati (Excel)"
        description="Colonne attese: giornata, casa, ospiti, risultato_set (es: 25-20, 25-21, 23-25, 25-22)."
      >
        <div className="space-y-3">
          <div>
            <label className="cs-label">Girone</label>
            <Select
              value={importResultsGroupId || ''}
              onChange={(e) => setImportResultsGroupId(e.target.value || null)}
            >
              {currentGroups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="cs-label">File Excel</label>
            <Input type="file" accept=".xlsx,.xls" onChange={(e) => setImportResultsFile(e.target.files?.[0] || null)} />
          </div>
          <div className="text-sm text-slate-600">
            La partita viene trovata con la chiave: giornata + casa + ospiti (codici squadra).
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowImportResultsModal(false)}>Annulla</Button>
            <Button onClick={handleImportResults} disabled={importingResults || mode === 'athlete'}>
              {importingResults ? 'Importazione...' : 'Importa risultati'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal gestione squadre girone */}
      {mode !== 'athlete' && (
        <Modal
          fullscreenOnMobile
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
                  await reloadChampionships()
                  if (selectedGroupId) await reloadGroupDetails()
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
