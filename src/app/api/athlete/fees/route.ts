import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (user as any)?.user_metadata?.role
    if (role !== 'athlete') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: base, error: baseErr } = await supabase
      .from('fee_installments')
      .select('id, installment_number, due_date, amount, status, paid_at, membership_fee_id')
      .eq('profile_id', user.id)
      .order('due_date', { ascending: true })

    if (baseErr) {
      console.error('Error loading fee installments (athlete):', baseErr)
      return NextResponse.json({ error: 'Failed to load installments' }, { status: 400 })
    }

    const feeIds = [...new Set((base || []).map((r: any) => r.membership_fee_id).filter(Boolean))]
    if (feeIds.length === 0) {
      return NextResponse.json({ installments: [] })
    }

    const { data: fees, error: feesErr } = await supabase
      .from('membership_fees')
      .select('id, team_id, name, description, total_amount, enrollment_fee, insurance_fee, monthly_fee, months_count, installments_count')
      .in('id', feeIds)

    if (feesErr) {
      console.error('Error loading membership fees:', feesErr)
      return NextResponse.json({ error: 'Failed to load fees' }, { status: 400 })
    }

    const teamIds = [...new Set((fees || []).map((f: any) => f.team_id).filter(Boolean))]
    const { data: teams = [] } = teamIds.length
      ? await supabase.from('teams').select('id, name, code, activity_id').in('id', teamIds)
      : { data: [] as any[] }

    const activityIds = [...new Set(teams.map((t: any) => t.activity_id).filter(Boolean))]
    const { data: activities = [] } = activityIds.length
      ? await supabase.from('activities').select('id, name').in('id', activityIds)
      : { data: [] as any[] }

    const feeMap = new Map((fees || []).map((f: any) => [f.id, f]))
    const teamMap = new Map(teams.map((t: any) => [t.id, t]))
    const activityMap = new Map(activities.map((a: any) => [a.id, a]))

    const composed = (base || []).map((row: any) => {
      const fee = feeMap.get(row.membership_fee_id)
      const team = fee ? teamMap.get(fee.team_id) : null
      const activity = team ? activityMap.get(team.activity_id) : null
      return {
        id: row.id,
        installment_number: row.installment_number,
        due_date: row.due_date,
        amount: row.amount,
        status: row.status,
        paid_at: row.paid_at || undefined,
        membership_fee: {
          id: fee?.id,
          name: fee?.name || 'Quota',
          description: fee?.description || undefined,
          total_amount: fee?.total_amount || 0,
          enrollment_fee: fee?.enrollment_fee || 0,
          insurance_fee: fee?.insurance_fee || 0,
          monthly_fee: fee?.monthly_fee || 0,
          months_count: fee?.months_count || 0,
          installments_count: fee?.installments_count || 1,
          team: {
            name: team?.name || 'N/D',
            code: team?.code || 'N/D',
            activity: { name: activity?.name || 'N/D' }
          }
        }
      }
    })

    return NextResponse.json({ installments: composed })
  } catch (error) {
    console.error('Athlete fees API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
