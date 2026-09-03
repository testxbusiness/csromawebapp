import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireSubjectAthleteContext } from '@/server/auth/require-subject-profile'
import { buildAthleteFeesContract } from '@/lib/athlete/fees-contract'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { searchParams } = new URL(request.url)
    const subject = await requireSubjectAthleteContext(supabase, searchParams.get('subjectProfileId'), 'view_payments')
    const athleteProfileId = subject.profileId
    const dataClient = subject.dataClient
    if (!athleteProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: base, error: baseErr } = await dataClient
      .from('fee_installments')
      .select('id, installment_number, due_date, amount, status, paid_at, membership_fee_id')
      .eq('profile_id', athleteProfileId)
      .order('due_date', { ascending: true })

    if (baseErr) {
      console.error('Error loading fee installments (athlete):', baseErr)
      return NextResponse.json({ error: 'Failed to load installments' }, { status: 400 })
    }

    const feeIds = [...new Set((base || []).map((r) => r.membership_fee_id).filter(Boolean))]
    if (feeIds.length === 0) {
      return NextResponse.json({ installments: [] })
    }

    const { data: fees, error: feesErr } = await dataClient
      .from('membership_fees')
      .select('id, team_id, name, description, total_amount, enrollment_fee, insurance_fee, monthly_fee, months_count, installments_count')
      .in('id', feeIds)

    if (feesErr) {
      console.error('Error loading membership fees:', feesErr)
      return NextResponse.json({ error: 'Failed to load fees' }, { status: 400 })
    }

    const teamIds = [...new Set((fees || []).map((f) => f.team_id).filter(Boolean))]
    const { data: teams = [] } = teamIds.length
      ? await dataClient.from('teams').select('id, name, code, activity_id').in('id', teamIds)
      : { data: [] as any[] }

    const safeTeams = teams || []
    const activityIds = [...new Set(safeTeams.map((t) => t.activity_id).filter(Boolean))]
    const { data: activities = [] } = activityIds.length
      ? await dataClient.from('activities').select('id, name').in('id', activityIds)
      : { data: [] as any[] }

    const contract = buildAthleteFeesContract(
      base || [],
      new Map((fees || []).map((fee) => [fee.id, fee])),
      new Map(safeTeams.map((team) => [team.id, team])),
      new Map((activities || []).map((activity) => [activity.id, activity])),
    )
    return NextResponse.json(contract)
  } catch (error) {
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Athlete fees API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
