import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { AccountContextError } from '@/server/auth/require-account-context'

export type ActiveSeason = {
  id: string
  name: string
  start_date: string
  end_date: string
  is_active: true
}

/** Resolves the operational season without relying on `.single()` semantics. */
export async function resolveActiveSeason(client: SupabaseClient): Promise<ActiveSeason | null> {
  const { data, error } = await client
    .from('seasons')
    .select('id, name, start_date, end_date, is_active')
    .eq('is_active', true)
    .limit(2)

  if (error) throw new AccountContextError('Impossibile risolvere la stagione attiva', 500)
  if (!data || data.length === 0) return null
  if (data.length > 1) throw new AccountContextError('Configurazione non valida: più stagioni attive', 500)

  const season = data[0]
  return {
    id: season.id,
    name: season.name,
    start_date: season.start_date,
    end_date: season.end_date,
    is_active: true,
  }
}

export async function resolveActiveSeasonTeamIds(
  client: SupabaseClient,
  seasonId: string,
): Promise<string[]> {
  const { data: activities, error: activitiesError } = await client
    .from('activities')
    .select('id')
    .eq('season_id', seasonId)
  if (activitiesError) throw new AccountContextError('Impossibile risolvere le attività della stagione attiva', 500)

  const activityIds = (activities ?? []).map((activity) => activity.id)
  if (activityIds.length === 0) return []

  const { data: teams, error: teamsError } = await client
    .from('teams')
    .select('id')
    .in('activity_id', activityIds)
  if (teamsError) throw new AccountContextError('Impossibile risolvere le squadre della stagione attiva', 500)
  return (teams ?? []).map((team) => team.id)
}
