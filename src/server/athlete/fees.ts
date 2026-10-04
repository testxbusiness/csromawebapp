import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { buildAthleteFeesContract } from '@/lib/athlete/fees-contract'
import type { AthleteFeesContract } from '@/types/athlete-fees'

export async function loadAthleteFeesContract(
  client: SupabaseClient,
  profileId: string,
  activeTeamIds: string[],
): Promise<AthleteFeesContract> {
  const { data: installments, error: installmentsError } = await client
    .from('fee_installments')
    .select('id, installment_number, due_date, amount, status, paid_at, membership_fee_id')
    .eq('profile_id', profileId)
    .order('due_date', { ascending: true })
  if (installmentsError) throw new Error('Impossibile caricare le rate atleta')

  const feeIds = [...new Set((installments ?? []).map((row) => row.membership_fee_id).filter(Boolean))]
  if (feeIds.length === 0 || activeTeamIds.length === 0) return { installments: [] }

  const { data: fees, error: feesError } = await client
    .from('membership_fees')
    .select('id, team_id, name, description, total_amount, enrollment_fee, insurance_fee, monthly_fee, months_count, installments_count')
    .in('id', feeIds)
    .in('team_id', activeTeamIds)
  if (feesError) throw new Error('Impossibile caricare le quote atleta')

  const teamIds = [...new Set((fees ?? []).map((fee) => fee.team_id).filter(Boolean))]
  const { data: teams, error: teamsError } = teamIds.length
    ? await client.from('teams').select('id, name, code, activity_id').in('id', teamIds)
    : { data: [], error: null }
  if (teamsError) throw new Error('Impossibile caricare le squadre delle quote')

  const activityIds = [...new Set((teams ?? []).map((team) => team.activity_id).filter(Boolean))]
  const { data: activities, error: activitiesError } = activityIds.length
    ? await client.from('activities').select('id, name').in('id', activityIds)
    : { data: [], error: null }
  if (activitiesError) throw new Error('Impossibile caricare le attività delle quote')

  return buildAthleteFeesContract(
    installments ?? [],
    new Map((fees ?? []).map((fee) => [fee.id, fee])),
    new Map((teams ?? []).map((team) => [team.id, team])),
    new Map((activities ?? []).map((activity) => [activity.id, activity])),
  )
}
