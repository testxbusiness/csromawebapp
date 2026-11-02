import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'
import { diagnoseFeeInstallments, type FeeInstallmentSafetyRow } from '@/server/admin/fee-safety'

/** Read-only financial anomaly report; it never repairs or updates records. */
export async function GET() {
  try {
    const supabase = await createClient()
    await requireGlobalRole(supabase, 'admin')
    const adminClient = createAdminClient()
    const { data: rawRows, error } = await adminClient.from('fee_installments')
      .select('id, profile_id, membership_fee_id, installment_number, amount, due_date, status, paid_at, paid_by_auth_user_id, payment_source')
    if (error) return NextResponse.json({ error: 'Impossibile caricare le rate per la diagnostica' }, { status: 500 })
    const rows = rawRows ?? []
    const feeIds = [...new Set(rows.map((row) => row.membership_fee_id))]
    const { data: fees, error: feesError } = feeIds.length
      ? await adminClient.from('membership_fees').select('id, team_id').in('id', feeIds)
      : { data: [], error: null }
    if (feesError) return NextResponse.json({ error: 'Impossibile risolvere i piani delle rate' }, { status: 500 })
    const teamIds = [...new Set((fees ?? []).map((fee) => fee.team_id))]
    const { data: teams, error: teamsError } = teamIds.length
      ? await adminClient.from('teams').select('id, activity_id').in('id', teamIds)
      : { data: [], error: null }
    if (teamsError) return NextResponse.json({ error: 'Impossibile risolvere le attività delle rate' }, { status: 500 })
    const activityIds = [...new Set((teams ?? []).map((team) => team.activity_id))]
    const { data: activities, error: activitiesError } = activityIds.length
      ? await adminClient.from('activities').select('id, season_id').in('id', activityIds)
      : { data: [], error: null }
    if (activitiesError) return NextResponse.json({ error: 'Impossibile risolvere le stagioni delle rate' }, { status: 500 })
    const teamById = new Map((teams ?? []).map((team) => [team.id, team]))
    const activityById = new Map((activities ?? []).map((activity) => [activity.id, activity]))
    const feeById = new Map((fees ?? []).map((fee) => [fee.id, fee]))
    const diagnosticRows: FeeInstallmentSafetyRow[] = rows.map((row) => {
      const fee = feeById.get(row.membership_fee_id)
      const team = fee ? teamById.get(fee.team_id) : null
      const activity = team ? activityById.get(team.activity_id) : null
      return { ...row, activity_id: team?.activity_id ?? null, season_id: activity?.season_id ?? null }
    })
    return NextResponse.json({ readOnly: true, ...diagnoseFeeInstallments(diagnosticRows) })
  } catch (error) {
    if (error instanceof AccountContextError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Errore diagnostica finanziaria:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
