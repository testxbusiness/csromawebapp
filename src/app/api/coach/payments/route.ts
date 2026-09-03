import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AccountContextError, requireAccountContext } from '@/server/auth/require-account-context'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const account = await requireAccountContext(supabase)
    if (!account.roles.includes('coach')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const requestedTeamId = new URL(request.url).searchParams.get('team_id')
    if (requestedTeamId) {
      const { data: assignment, error: assignmentError } = await supabase
        .from('team_coaches')
        .select('team_id')
        .eq('coach_id', account.ownerProfileId)
        .eq('team_id', requestedTeamId)
        .maybeSingle()

      if (assignmentError) {
        return NextResponse.json({ error: assignmentError.message }, { status: 500 })
      }
      if (!assignment) {
        return NextResponse.json({ error: 'Squadra non assegnata al coach' }, { status: 403 })
      }
    }

    // Coach can view only own payments (RLS enforces as well); limit to coach_payment type
    let paymentsQuery = supabase
      .from('payments')
      .select(`
        *,
        gyms (
          id,
          name,
          address
        ),
        activities (
          id,
          name
        ),
        teams (
          id,
          name,
          code
        ),
        coaches:profiles!payments_coach_id_fkey (
          id,
          first_name,
          last_name
        ),
        created_by_profile:profiles!payments_created_by_fkey (
          first_name,
          last_name
        )
      `)
      .eq('type', 'coach_payment')
      .eq('coach_id', account.ownerProfileId)
    if (requestedTeamId) paymentsQuery = paymentsQuery.eq('team_id', requestedTeamId)
    const { data, error } = await paymentsQuery.order('due_date', { ascending: true, nullsFirst: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
