'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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
}

export function useChampionshipCatalog({
  mode,
  coachTeamIds = new Set<string>(),
  athleteTeamIds = new Set<string>(),
}: UseChampionshipCatalogOptions) {
  const supabase = useMemo(() => createClient(), [])
  const [championships, setChampionships] = useState<Championship[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(false)

  const loadSelectData = useCallback(async () => {
    const [{ data: seasonsData }, { data: activitiesData }, { data: teamsData }] = await Promise.all([
      supabase.from('seasons').select('id, name').order('start_date', { ascending: false }),
      supabase.from('activities').select('id, name, season_id').order('name'),
      supabase.from('teams').select('id, name, code, coach_id').order('name'),
    ])

    setSeasons((seasonsData || []) as Season[])
    setActivities((activitiesData || []) as Activity[])
    setTeams((teamsData || []) as Team[])
  }, [supabase])

  const reload = useCallback(async () => {
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
      setChampionships([])
      setLoading(false)
      return
    }

    let filtered = data || []
    const allowedTeamIds = mode === 'coach' ? coachTeamIds : athleteTeamIds
    if (mode === 'coach' || mode === 'athlete') {
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
    setLoading(false)
  }, [athleteTeamIds, coachTeamIds, mode, supabase])

  useEffect(() => {
    void loadSelectData()
  }, [loadSelectData])

  useEffect(() => {
    void reload()
  }, [reload])

  return { championships, seasons, activities, teams, loading, reload }
}
