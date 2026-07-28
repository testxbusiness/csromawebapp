import { useCallback, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/ui'
import { firstRelation, type Convocation, type Match, type TeamMember } from '@/components/championship/types'

export function useChampionshipConvocations() {
  const supabase = useMemo(() => createClient(), [])
  const [convocationLoading, setConvocationLoading] = useState(false)
  const [convocationSaving, setConvocationSaving] = useState(false)
  const [convocation, setConvocation] = useState<Convocation | null>(null)
  const [convocationSelection, setConvocationSelection] = useState<Set<string>>(new Set())
  const [convocationTeamMembers, setConvocationTeamMembers] = useState<TeamMember[]>([])

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

  const loadConvocationData = useCallback(async (match: Match, clubTeamId: string, teamId: string | null) => {
    setConvocationLoading(true)
    try {
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
    } catch (error) {
      console.error('Errore caricamento convocazioni', error)
      toast.error('Impossibile caricare le convocazioni')
      setConvocation(null)
      setConvocationSelection(new Set())
    } finally {
      setConvocationLoading(false)
    }
  }, [loadTeamMembers, supabase])

  const saveConvocation = useCallback(async ({ match, clubTeamId, teamId }: {
    match: Match
    clubTeamId: string
    teamId: string
  }) => {
    setConvocationSaving(true)
    try {
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
  }, [convocation?.id, convocationSelection, convocationTeamMembers, loadConvocationData, supabase])

  return {
    convocation,
    convocationLoading,
    convocationSaving,
    convocationSelection,
    convocationTeamMembers,
    loadConvocationData,
    saveConvocation,
    setConvocation,
    setConvocationLoading,
    setConvocationSelection,
    setConvocationTeamMembers,
  }
}
