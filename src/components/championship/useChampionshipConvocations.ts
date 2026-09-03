import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { requestErrorState, responseErrorState, type RequestState } from '@/lib/http/request-state'
import { toast } from '@/components/ui'
import { SUBJECT_CONTEXT_CHANGED_EVENT, type SubjectContextChangedDetail } from '@/context/AccessibleProfileContext'
import { firstRelation, type Convocation, type Match, type TeamMember } from '@/components/championship/types'

export function useChampionshipConvocations({ subjectProfileId, enabled = true, coachAuthorized = false }: { subjectProfileId?: string | null; enabled?: boolean; coachAuthorized?: boolean } = {}) {
  const supabase = useMemo(() => createClient(), [])
  const [convocationStatus, setConvocationStatus] = useState<RequestState>('idle')
  const [convocationSaving, setConvocationSaving] = useState(false)
  const [convocation, setConvocation] = useState<Convocation | null>(null)
  const [convocationSelection, setConvocationSelection] = useState<Set<string>>(new Set())
  const [convocationTeamMembers, setConvocationTeamMembers] = useState<TeamMember[]>([])
  const requestRef = useRef<AbortController | null>(null)
  const subjectRef = useRef<string | null | undefined>(subjectProfileId)

  useEffect(() => {
    const handleSubjectChange = (event: Event) => {
      subjectRef.current = (event as CustomEvent<SubjectContextChangedDetail>).detail?.subjectProfileId ?? null
      requestRef.current?.abort()
      setConvocation(null)
      setConvocationSelection(new Set())
      setConvocationTeamMembers([])
      setConvocationStatus('idle')
    }
    window.addEventListener(SUBJECT_CONTEXT_CHANGED_EVENT, handleSubjectChange)
    return () => window.removeEventListener(SUBJECT_CONTEXT_CHANGED_EVENT, handleSubjectChange)
  }, [])

  const loadTeamMembers = useCallback(async (teamId: string | null) => {
    if (!teamId) {
      setConvocationTeamMembers([])
      return
    }

    const { data, error } = await supabase
      .from('team_members')
      .select('id, profile_id, jersey_number, profiles ( first_name, last_name )')
      .eq('team_id', teamId)
      .eq('role', 'athlete')
      .order('id', { ascending: true })
    if (error) {
      console.error('Errore caricamento atleti squadra', error)
      toast.error('Impossibile caricare gli atleti della squadra')
      setConvocationTeamMembers([])
      return
    }

    setConvocationTeamMembers((data || []).map((member: any) => ({
      ...member,
      profiles: firstRelation(member.profiles),
    })) as TeamMember[])
  }, [supabase])

  const loadConvocationData = useCallback(async (match: Match, clubTeamId: string, teamId: string | null): Promise<Convocation | null> => {
    if (!enabled) return null
    subjectRef.current = subjectProfileId
    requestRef.current?.abort()
    const controller = new AbortController()
    setConvocationStatus('loading')
    try {
      if (subjectProfileId !== undefined) {
        const params = new URLSearchParams({
          view: 'convocation',
          matchId: match.id,
          clubTeamId,
        })
        if (subjectProfileId) params.set('subjectProfileId', subjectProfileId)
        const response = await fetch(`/api/athlete/championships?${params.toString()}`, { cache: 'no-store', signal: controller.signal })
        const payload = await response.json().catch(() => null) as { convocation?: any; error?: string } | null
        if (controller.signal.aborted || subjectRef.current !== subjectProfileId) return null
        if (!response.ok) {
          setConvocationStatus(responseErrorState(response.status))
          return null
        }
        const data = payload?.convocation
        const normalizedConvocation = data ? {
          ...data,
          championship_club_teams: firstRelation(data.championship_club_teams),
          championship_match_convocation_members: (data.championship_match_convocation_members || []).map((member: any) => ({
            ...member,
            profiles: firstRelation(member.profiles),
            team_members: firstRelation(member.team_members),
          })),
        } as Convocation : null
        setConvocation(normalizedConvocation || {
          match_id: match.id,
          championship_club_team_id: clubTeamId,
          team_id: teamId,
        })
        const selectedIds = new Set<string>()
        data?.championship_match_convocation_members?.forEach((member: any) => {
          if (member.team_member_id) selectedIds.add(member.team_member_id)
        })
        setConvocationSelection(selectedIds)
        setConvocationTeamMembers([])
        setConvocationStatus('ready')
        return normalizedConvocation
      }

      const { data, error } = await supabase
        .from('championship_match_convocations')
        .select(`
          id, match_id, championship_club_team_id, team_id, notes,
          championship_club_teams ( id, name, is_home_club, team_id ),
          championship_match_convocation_members (
            team_member_id, profile_id,
            profiles ( first_name, last_name ),
            team_members ( profile_id, jersey_number, profiles ( first_name, last_name ) )
          )
        `)
        .eq('match_id', match.id)
        .eq('championship_club_team_id', clubTeamId)
        .maybeSingle()
      if (error && error.code !== 'PGRST116') throw error

      const normalizedConvocation = data ? {
        ...data,
        championship_club_teams: firstRelation((data as any).championship_club_teams),
        championship_match_convocation_members: ((data as any).championship_match_convocation_members || []).map((member: any) => ({
          ...member,
          profiles: firstRelation(member.profiles),
          team_members: firstRelation(member.team_members),
        })),
      } as Convocation : null
      setConvocation(normalizedConvocation || {
        match_id: match.id,
        championship_club_team_id: clubTeamId,
        team_id: teamId,
      })

      const selectedIds = new Set<string>()
      data?.championship_match_convocation_members?.forEach((member) => {
        if (member.team_member_id) selectedIds.add(member.team_member_id)
      })
      setConvocationSelection(selectedIds)
      await loadTeamMembers(teamId)
      setConvocationStatus('ready')
      return normalizedConvocation
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return null
      console.error('Errore caricamento convocazioni', error)
      toast.error('Impossibile caricare le convocazioni')
      setConvocationStatus(requestErrorState(error))
      return null
    } finally {
      setConvocationStatus((current) => current === 'loading' ? 'error' : current)
    }
  }, [enabled, loadTeamMembers, subjectProfileId, supabase])

  const saveConvocation = useCallback(async ({ match, clubTeamId, teamId }: {
    match: Match
    clubTeamId: string
    teamId: string
  }) => {
    setConvocationSaving(true)
    try {
      if (coachAuthorized) {
        const response = await fetch('/api/coach/championships/mutations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save_convocation', convocation_id: convocation?.id, match_id: match.id, club_team_id: clubTeamId, team_id: teamId, members: Array.from(convocationSelection).map((teamMemberId) => ({ team_member_id: teamMemberId, profile_id: convocationTeamMembers.find((member) => member.id === teamMemberId)?.profile_id || null })) }) })
        if (!response.ok) throw new Error('Impossibile salvare le convocazioni')
        toast.success('Convocazioni salvate')
        await loadConvocationData(match, clubTeamId, teamId)
        return
      }
      const { data: upserted, error: upsertError } = await supabase
        .from('championship_match_convocations')
        .upsert({
          id: convocation?.id,
          match_id: match.id,
          championship_club_team_id: clubTeamId,
          team_id: teamId,
        }, { onConflict: 'match_id,championship_club_team_id' })
        .select('id')
        .single()
      if (upsertError) throw upsertError

      const { error: deleteError } = await supabase
        .from('championship_match_convocation_members')
        .delete()
        .eq('convocation_id', upserted.id)
      if (deleteError) throw deleteError

      if (convocationSelection.size > 0) {
        const membersById = new Map(convocationTeamMembers.map((member) => [member.id, member]))
        const { error: insertError } = await supabase
          .from('championship_match_convocation_members')
          .insert(Array.from(convocationSelection).map((teamMemberId) => ({
            convocation_id: upserted.id,
            team_member_id: teamMemberId,
            profile_id: membersById.get(teamMemberId)?.profile_id || null,
          })))
        if (insertError) throw insertError
      }

      toast.success('Convocazioni salvate')
      await loadConvocationData(match, clubTeamId, teamId)
    } catch (error) {
      console.error('Errore salvataggio convocazioni', error)
      toast.error('Impossibile salvare le convocazioni')
    } finally {
      setConvocationSaving(false)
    }
  }, [coachAuthorized, convocation?.id, convocationSelection, convocationTeamMembers, loadConvocationData, supabase])

  return {
    convocation,
    convocationLoading: convocationStatus === 'loading',
    convocationStatus,
    convocationSaving,
    convocationSelection,
    convocationTeamMembers,
    loadConvocationData,
    saveConvocation,
    setConvocation,
    setConvocationSelection,
    setConvocationTeamMembers,
  }
}
