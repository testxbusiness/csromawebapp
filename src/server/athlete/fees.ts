import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildAthleteFeesContract,
  type RawActivity,
  type RawFeeInstallment,
  type RawMembershipFee,
  type RawTeam,
} from '@/lib/athlete/fees-contract'
import type { AthleteFeesContract } from '@/types/athlete-fees'

function nestedRelation(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return (value[0] as Record<string, unknown> | undefined) ?? null
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

export async function loadAthleteFeesContract(
  client: SupabaseClient,
  profileId: string,
  activeTeamIds: string[],
): Promise<AthleteFeesContract> {
  if (activeTeamIds.length === 0) return { installments: [] }

  const { data: installments, error: installmentsError } = await client
    .from('fee_installments')
    .select(`
      id,
      installment_number,
      due_date,
      amount,
      status,
      paid_at,
      membership_fee_id,
      membership_fees!inner(
        id,
        team_id,
        name,
        description,
        total_amount,
        enrollment_fee,
        insurance_fee,
        monthly_fee,
        months_count,
        installments_count,
        teams!inner(
          id,
          name,
          code,
          activity_id,
          activities!inner(id, name)
        )
      )
    `)
    .eq('profile_id', profileId)
    .in('membership_fees.team_id', activeTeamIds)
    .order('due_date', { ascending: true })
  if (installmentsError) throw new Error('Impossibile caricare le rate atleta')

  const fees = new Map<string, RawMembershipFee>()
  const teams = new Map<string, RawTeam>()
  const activities = new Map<string, RawActivity>()
  const normalizedInstallments: RawFeeInstallment[] = (installments ?? []).map((row) => {
    const nestedFee = nestedRelation(row.membership_fees)
    const nestedTeam = nestedRelation(nestedFee?.teams)
    const nestedActivity = nestedRelation(nestedTeam?.activities)

    if (nestedFee?.id && nestedFee.team_id) fees.set(String(nestedFee.id), nestedFee as RawMembershipFee)
    if (nestedTeam?.id && nestedTeam.name && nestedTeam.code) teams.set(String(nestedTeam.id), nestedTeam as RawTeam)
    if (nestedActivity?.id && nestedActivity.name) activities.set(String(nestedActivity.id), nestedActivity as RawActivity)

    const { membership_fees: _membershipFees, ...installment } = row
    return installment as RawFeeInstallment
  })

  return buildAthleteFeesContract(
    normalizedInstallments,
    fees,
    teams,
    activities,
  )
}
