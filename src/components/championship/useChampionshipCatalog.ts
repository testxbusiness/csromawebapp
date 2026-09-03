'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { requestErrorState, responseErrorState, type RequestState } from '@/lib/http/request-state'
import { SUBJECT_CONTEXT_CHANGED_EVENT, type SubjectContextChangedDetail } from '@/context/AccessibleProfileContext'
import {
  firstRelation,
  type Activity,
  type Championship,
  type ManagerMode,
  type Season,
  type Team,
} from './types'

type UseChampionshipCatalogOptions = {
  mode: ManagerMode
  coachTeamIds?: Set<string>
  athleteTeamIds?: Set<string>
  subjectProfileId?: string | null
  enabled?: boolean
}

const EMPTY_TEAM_IDS = new Set<string>()

export function useChampionshipCatalog({
  mode,
  coachTeamIds = EMPTY_TEAM_IDS,
  subjectProfileId = null,
  enabled = true,
}: UseChampionshipCatalogOptions) {
  const supabase = useMemo(() => createClient(), [])
  const [championships, setChampionships] = useState<Championship[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [status, setStatus] = useState<RequestState>('loading')
  const requestRef = useRef<AbortController | null>(null)
  const subjectRef = useRef<string | null | undefined>(subjectProfileId)

  useEffect(() => {
    const handleSubjectChange = (event: Event) => {
      subjectRef.current = (event as CustomEvent<SubjectContextChangedDetail>).detail?.subjectProfileId ?? null
      requestRef.current?.abort()
      setChampionships([])
      setSeasons([])
      setActivities([])
      setTeams([])
      setStatus('loading')
    }
    window.addEventListener(SUBJECT_CONTEXT_CHANGED_EVENT, handleSubjectChange)
    return () => window.removeEventListener(SUBJECT_CONTEXT_CHANGED_EVENT, handleSubjectChange)
  }, [])

  const loadSelectData = useCallback(async () => {
    if (!enabled) {
      setSeasons([])
      setActivities([])
      setTeams([])
      return
    }
    if (mode === 'athlete') {
      setSeasons([])
      setActivities([])
      setTeams([])
      return
    }
    const [{ data: seasonsData }, { data: activitiesData }, { data: teamsData }] = await Promise.all([
      supabase.from('seasons').select('id, name').order('start_date', { ascending: false }),
      supabase.from('activities').select('id, name, season_id').order('name'),
      supabase.from('teams').select('id, name, code, coach_id').order('name'),
    ])

    setSeasons((seasonsData || []) as Season[])
    setActivities((activitiesData || []) as Activity[])
    setTeams((teamsData || []) as Team[])
  }, [enabled, mode, supabase])

  const reload = useCallback(async () => {
    if (!enabled) {
      setChampionships([])
      setStatus('idle')
      return
    }
    subjectRef.current = subjectProfileId
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setStatus('loading')
    if (mode === 'athlete') {
      try {
        const params = new URLSearchParams({ view: 'catalog' })
        if (subjectProfileId) params.set('subjectProfileId', subjectProfileId)
        const response = await fetch(`/api/athlete/championships?${params.toString()}`, { cache: 'no-store', signal: controller.signal })
        const payload = await response.json().catch(() => null) as {
          teams?: Array<{ id: string; name: string; code?: string | null }>
          championships?: any[]
          error?: string
        } | null
        if (controller.signal.aborted || subjectRef.current !== subjectProfileId) return
        if (!response.ok) {
          setStatus(responseErrorState(response.status))
          return
        }

        const resolvedTeams = (payload?.teams ?? []) as Array<{ id: string; name: string; code?: string | null }>
        const teamById = new Map(resolvedTeams.map((team) => [team.id, team]))
        setTeams(resolvedTeams as Team[])
        const normalized = (payload?.championships ?? []).map((championship: any) => ({
          id: championship.id,
          name: championship.name,
          status: championship.status,
          sport: championship.sport,
          start_date: championship.start_date,
          end_date: championship.end_date,
          team_ids: championship.teamIds ?? [],
          clubTeams: (championship.clubTeams ?? []).map((clubTeam: any) => ({
            id: clubTeam.id,
            championship_id: clubTeam.championship_id,
            code: clubTeam.code,
            name: clubTeam.name,
            is_home_club: Boolean(clubTeam.is_home_club),
            team_id: clubTeam.team_id ?? null,
          })),
          championship_groups: (championship.groups ?? []).map((group: any) => ({
            id: group.id,
            name: group.name,
            phase: group.phase,
            sort_order: group.sort_order,
            championship_group_teams: (group.clubTeamIds ?? []).map((clubTeamId: string) => {
              const clubTeam = (championship.clubTeams ?? []).find((candidate: any) => candidate.id === clubTeamId)
              const team = clubTeam?.team_id ? teamById.get(clubTeam.team_id) : undefined
              return {
                id: `${group.id}:${clubTeamId}`,
                championship_club_team_id: clubTeamId,
                is_home_club: Boolean(clubTeam?.is_home_club),
                championship_club_teams: clubTeam ? { ...clubTeam, teams: team ? [team] : [] } : undefined,
              }
            }),
          })),
        })) as Championship[]
        setChampionships(normalized)
        setStatus('ready')
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.error('Errore caricamento campionati atleta', error)
        setStatus(requestErrorState(error))
      }
      return
    }

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
      setChampionships([])
      setStatus('error')
      return
    }

    let filtered = data || []
    const allowedTeamIds = coachTeamIds
    if (mode === 'coach') {
      if (allowedTeamIds.size === 0) {
        filtered = []
      } else {
        filtered = (filtered as any[])
          .map((championship) => {
            const visibleGroups = (championship.championship_groups || [])
              .map((group: any) => {
                const visibleGroupTeams = (group.championship_group_teams || []).filter((groupTeam: any) => {
                  const clubTeam = firstRelation(groupTeam.championship_club_teams)
                  return clubTeam?.team_id && allowedTeamIds.has(clubTeam.team_id)
                })

                return visibleGroupTeams.length > 0
                  ? { ...group, championship_group_teams: visibleGroupTeams }
                  : null
              })
              .filter(Boolean)

            return visibleGroups.length > 0
              ? { ...championship, championship_groups: visibleGroups }
              : null
          })
          .filter(Boolean)
      }
    }

    const normalized = (filtered as any[]).map((championship) => ({
      ...championship,
      championship_groups: (championship.championship_groups || []).map((group: any) => ({
        ...group,
        championship_group_teams: (group.championship_group_teams || []).map((groupTeam: any) => ({
          ...groupTeam,
          championship_club_teams: firstRelation(groupTeam.championship_club_teams),
        })),
      })),
    })) as Championship[]

    setChampionships(normalized)
    setStatus('ready')
  }, [coachTeamIds, enabled, mode, subjectProfileId, supabase])

  useEffect(() => {
    void loadSelectData()
  }, [loadSelectData])

  useEffect(() => {
    void reload()
  }, [reload])

  return { championships, seasons, activities, teams, loading: status === 'loading', status, reload }
}
