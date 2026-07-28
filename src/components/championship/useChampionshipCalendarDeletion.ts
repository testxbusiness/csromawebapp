import { useCallback, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/ui'

type CalendarScope = 'group' | 'championship'

interface DeleteCalendarInput {
  scope: CalendarScope
  groupIds: string[]
  championshipId?: string | null
  onSuccess?: (scope: CalendarScope) => void | Promise<void>
}

export function useChampionshipCalendarDeletion() {
  const supabase = useMemo(() => createClient(), [])
  const [deleting, setDeleting] = useState<CalendarScope | null>(null)

  const deleteCalendar = useCallback(async ({ scope, groupIds, championshipId, onSuccess }: DeleteCalendarInput) => {
    if (groupIds.length === 0) {
      toast.error('Nessun girone da cancellare')
      return
    }

    setDeleting(scope)
    try {
      const { data: matches, error: matchesError } = await supabase
        .from('championship_matches')
        .select('id, event_id')
        .in('championship_group_id', groupIds)
      if (matchesError) throw matchesError

      const matchIds = (matches || []).map((match) => match.id)
      const eventIds = (matches || []).map((match) => match.event_id).filter(Boolean)
      if (eventIds.length) {
        const { error: eventTeamsError } = await supabase.from('event_teams').delete().in('event_id', eventIds as string[])
        if (eventTeamsError) throw eventTeamsError
        const { error: eventsError } = await supabase.from('events').delete().in('id', eventIds as string[])
        if (eventsError) throw eventsError
      }
      if (matchIds.length) {
        const { error: setsError } = await supabase.from('championship_match_sets').delete().in('match_id', matchIds)
        if (setsError) throw setsError
      }

      const { error: matchesDeleteError } = await supabase.from('championship_matches').delete().in('championship_group_id', groupIds)
      if (matchesDeleteError) throw matchesDeleteError
      const { error: groupTeamsError } = await supabase.from('championship_group_teams').delete().in('championship_group_id', groupIds)
      if (groupTeamsError) throw groupTeamsError

      const { error: groupsError } = await supabase.from('championship_groups').delete().in('id', groupIds)
      if (groupsError) throw groupsError

      if (scope === 'championship' && championshipId) {
        const { error: clubTeamsError } = await supabase.from('championship_club_teams').delete().eq('championship_id', championshipId)
        if (clubTeamsError) throw clubTeamsError
        const { error: championshipError } = await supabase.from('championships').delete().eq('id', championshipId)
        if (championshipError) throw championshipError
      }

      toast.success('Calendario eliminato')
      await onSuccess?.(scope)
    } catch (error) {
      console.error('Errore eliminazione calendario', error)
      toast.error('Impossibile eliminare il calendario')
    } finally {
      setDeleting(null)
    }
  }, [supabase])

  return { deleteCalendar, deleting }
}
