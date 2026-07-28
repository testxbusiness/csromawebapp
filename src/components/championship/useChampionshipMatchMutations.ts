import { useCallback, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/ui'

type ReloadGroupDetails = () => Promise<unknown>
type SuccessCallback = () => void | Promise<void>

interface MatchInfoInput {
  matchId: string
  matchDate: string
  startTime: string
  locationText: string
  onSuccess?: SuccessCallback
}

interface ResultInput {
  matchId: string
  result: string
  onSuccess?: SuccessCallback
}

interface UseChampionshipMatchMutationsOptions {
  selectedGroupId: string | null
  reloadGroupDetails: ReloadGroupDetails
}

function parseResultInput(input: string) {
  if (!input.trim()) return []
  return input.split(',').map((part) => {
    const [home, away] = part.trim().split('-').map((value) => parseInt(value, 10))
    if (Number.isNaN(home) || Number.isNaN(away)) {
      throw new Error('Formato non valido. Usa es. "25-20, 25-21, 28-26"')
    }
    return { home, away }
  })
}

export function useChampionshipMatchMutations({
  selectedGroupId,
  reloadGroupDetails,
}: UseChampionshipMatchMutationsOptions) {
  const supabase = useMemo(() => createClient(), [])
  const [savingResult, setSavingResult] = useState(false)
  const [infoSaving, setInfoSaving] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null)

  const saveMatchInfo = useCallback(async ({
    matchId,
    matchDate,
    startTime,
    locationText,
    onSuccess,
  }: MatchInfoInput) => {
    setInfoSaving(true)
    try {
      const { error } = await supabase
        .from('championship_matches')
        .update({
          match_date: matchDate || null,
          start_time: startTime ? `${startTime}:00` : null,
          location_text: locationText || null,
        })
        .eq('id', matchId)
      if (error) throw error
      toast.success('Info gara aggiornate')
      await onSuccess?.()
      if (selectedGroupId) await reloadGroupDetails()
    } catch (error) {
      console.error('Errore aggiornamento info gara', error)
      toast.error('Impossibile aggiornare le info gara')
    } finally {
      setInfoSaving(false)
    }
  }, [reloadGroupDetails, selectedGroupId, supabase])

  const saveResult = useCallback(async ({ matchId, result, onSuccess }: ResultInput) => {
    let setsToSave: { home: number; away: number }[]
    try {
      setsToSave = parseResultInput(result)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Formato punteggio non valido')
      return
    }

    setSavingResult(true)
    try {
      const { error: deleteError } = await supabase
        .from('championship_match_sets')
        .delete()
        .eq('match_id', matchId)
      if (deleteError) throw deleteError

      if (setsToSave.length > 0) {
        const { error: insertError } = await supabase.from('championship_match_sets').insert(
          setsToSave.map((set, index) => ({
            match_id: matchId,
            set_number: index + 1,
            home_points: set.home,
            away_points: set.away,
          }))
        )
        if (insertError) throw insertError
      }

      const { error: statusError } = await supabase
        .from('championship_matches')
        .update({ status: setsToSave.length > 0 ? 'completed' : 'scheduled' })
        .eq('id', matchId)
      if (statusError) throw statusError

      toast.success('Risultato salvato e classifica aggiornata')
      await onSuccess?.()
      if (selectedGroupId) await reloadGroupDetails()
    } catch (error) {
      console.error('Errore salvataggio risultato', error)
      toast.error('Impossibile salvare il risultato')
    } finally {
      setSavingResult(false)
    }
  }, [reloadGroupDetails, selectedGroupId, supabase])

  const changeStatus = useCallback(async (matchId: string, status: string) => {
    setStatusUpdating(matchId)
    try {
      const { error } = await supabase
        .from('championship_matches')
        .update({ status })
        .eq('id', matchId)
      if (error) throw error
      toast.success('Stato partita aggiornato')
      if (selectedGroupId) await reloadGroupDetails()
    } catch (error) {
      console.error('Errore aggiornamento stato', error)
      toast.error('Impossibile aggiornare lo stato')
    } finally {
      setStatusUpdating(null)
    }
  }, [reloadGroupDetails, selectedGroupId, supabase])

  return { changeStatus, infoSaving, saveMatchInfo, saveResult, savingResult, statusUpdating }
}
