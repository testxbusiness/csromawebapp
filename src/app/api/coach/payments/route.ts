import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const role = (user as any)?.user_metadata?.role
    if (role !== 'coach') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Coach can view only own payments (RLS enforces as well); limit to coach_payment type
    const { data, error } = await supabase
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
      .eq('coach_id', user.id)          // 👈 filtro fondamentale
      .order('due_date', { ascending: true, nullsFirst: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

