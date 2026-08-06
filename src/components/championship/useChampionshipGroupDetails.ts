'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { firstRelation, type Match, type Standing } from './types'

export function useChampionshipGroupDetails(groupId: string | null) {
  const supabase = useMemo(() => createClient(), [])
  const [matches, setMatches] = useState<Match[]>([])
  const [standings, setStandings] = useState<Standing[]>([])
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!groupId) {
      setMatches([])
      setStandings([])
      return
    }

    setLoading(true)
    try {
      const [{ data: matchesData, error: matchesError }, standingsResponse] = await Promise.all([
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
          .order('match_day', { ascending: true })
          .order('match_date', { ascending: true }),
        fetch(`/api/championships/standings?group_id=${encodeURIComponent(groupId)}`, {
          cache: 'no-store',
        }),
      ])

      if (matchesError) throw matchesError

      const standingsPayload = standingsResponse.ok
        ? await standingsResponse.json() as { standings?: Standing[] }
        : { standings: [] }

      setMatches((matchesData || []).map((match: any) => ({
        ...match,
        home_club_team: firstRelation(match.home_club_team),
        away_club_team: firstRelation(match.away_club_team),
      })) as Match[])
      setStandings(standingsPayload.standings ?? [])
    } catch (error) {
      console.error('Errore caricamento dettagli girone', error)
      setMatches([])
      setStandings([])
    } finally {
      setLoading(false)
    }
  }, [groupId, supabase])

  useEffect(() => {
    void reload()
  }, [reload])

  return { matches, standings, loading, reload }
}
