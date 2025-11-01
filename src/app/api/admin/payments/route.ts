import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { sendToUser } from '@/lib/utils/push'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const role = (user as any)?.user_metadata?.role
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const adminClient = await createAdminClient()
    
    const { data, error } = await adminClient
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
      .order('due_date', { ascending: true, nullsFirst: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const paymentData = await request.json()
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const role = (user as any)?.user_metadata?.role
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const adminClient = await createAdminClient()

    // Normalize payload to DB vocabulary and add auditing fields
    const normalized: any = {
      ...paymentData,
      status: paymentData?.status === 'to_pay' || !paymentData?.status ? 'pending' : paymentData.status,
      created_by: user.id,
    }

    // Enforce DB check constraints for type/coach_id
    if (normalized?.type === 'general_cost') {
      // General costs must not be tied to a coach
      normalized.coach_id = null
    } else if (normalized?.type === 'coach_payment') {
      // Coach payments must have a coach_id
      if (!normalized?.coach_id) {
        return NextResponse.json({ error: 'coach_id richiesto per type=coach_payment' }, { status: 400 })
      }
    }

    const { data, error } = await adminClient
      .from('payments')
      .insert([normalized])
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data?.[0] || null)
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, ...updateData } = await request.json()
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const role = (user as any)?.user_metadata?.role
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const adminClient = await createAdminClient()

    const { error } = await adminClient
      .from('payments')
      .update(updateData)
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Push notification when a coach_payment becomes paid
    try {
      if (updateData?.status === 'paid') {
        const { data: row } = await adminClient
          .from('payments')
          .select('id, type, coach_id, description')
          .eq('id', id)
          .single()
        if (row && row.type === 'coach_payment' && row.coach_id) {
          await sendToUser(row.coach_id, {
            title: 'Pagamento registrato',
            body: `Il pagamento “${row.description ?? ''}” risulta pagato`,
            url: '/coach/payments',
            icon: '/images/logo_CSRoma.png',
            badge: '/favicon.ico',
          })
        }
      }
    } catch (e) {
      console.error('push notify (payments) error:', e)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const role = (user as any)?.user_metadata?.role
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const adminClient = await createAdminClient()

    const { error } = await adminClient
      .from('payments')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
