'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { requestErrorState, responseErrorState, type RequestState } from '@/lib/http/request-state'
import { SUBJECT_CONTEXT_CHANGED_EVENT, type SubjectContextChangedDetail } from '@/context/AccessibleProfileContext'
import { firstRelation, type Match, type Standing } from './types'

export function useChampionshipGroupDetails(groupId: string | null, subjectProfileId?: string | null, enabled = true) {
  const supabase = useMemo(() => createClient(), [])
  const [matches, setMatches] = useState<Match[]>([])
  const [standings, setStandings] = useState<Standing[]>([])
  const [status, setStatus] = useState<RequestState>('idle')
  const requestRef = useRef<AbortController | null>(null)
  const subjectRef = useRef<string | null | undefined>(subjectProfileId)

  useEffect(() => {
    const handleSubjectChange = (event: Event) => {
      subjectRef.current = (event as CustomEvent<SubjectContextChangedDetail>).detail?.subjectProfileId ?? null
      requestRef.current?.abort()
      setMatches([])
      setStandings([])
      setStatus('idle')
    }
    window.addEventListener(SUBJECT_CONTEXT_CHANGED_EVENT, handleSubjectChange)
    return () => window.removeEventListener(SUBJECT_CONTEXT_CHANGED_EVENT, handleSubjectChange)
  }, [])

  const reload = useCallback(async () => {
    if (!enabled) {
      setMatches([])
      setStandings([])
      setStatus('idle')
      return
    }
    subjectRef.current = subjectProfileId
    requestRef.current?.abort()
    const controller = new AbortController()
    if (!groupId) {
      setMatches([])
      setStandings([])
      setStatus('ready')
      return
    }

    setStatus('loading')
    try {
      if (subjectProfileId !== undefined) {
        const params = new URLSearchParams({ view: 'group', groupId })
        if (subjectProfileId) params.set('subjectProfileId', subjectProfileId)
        const response = await fetch(`/api/athlete/championships?${params.toString()}`, { cache: 'no-store', signal: controller.signal })
        const payload = await response.json().catch(() => null) as { matches?: any[]; standings?: Standing[]; error?: string } | null
        if (controller.signal.aborted || subjectRef.current !== subjectProfileId) return
        if (!response.ok) {
          setStatus(responseErrorState(response.status))
          return
        }
        setMatches((payload?.matches ?? []).map((match: any) => ({
          ...match,
          home_club_team: firstRelation(match.home_club_team),
          away_club_team: firstRelation(match.away_club_team),
        })) as Match[])
        setStandings(payload?.standings ?? [])
        setStatus('ready')
        return
      }

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

      if (!standingsResponse.ok) {
        setStatus(responseErrorState(standingsResponse.status))
        return
      }
      const standingsPayload = await standingsResponse.json() as { standings?: Standing[] }

      setMatches((matchesData || []).map((match: any) => ({
        ...match,
        home_club_team: firstRelation(match.home_club_team),
        away_club_team: firstRelation(match.away_club_team),
      })) as Match[])
      setStandings(standingsPayload.standings ?? [])
      setStatus('ready')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      console.error('Errore caricamento dettagli girone', error)
      setStatus(requestErrorState(error))
    } finally {
      setStatus((current) => current === 'loading' ? 'error' : current)
    }
  }, [enabled, groupId, subjectProfileId, supabase])

  useEffect(() => {
    void reload()
  }, [reload])

  return { matches, standings, loading: status === 'loading', status, reload }
}
