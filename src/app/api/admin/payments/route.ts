import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { sendToUser } from '@/lib/utils/push'
import { paymentCreateSchema, paymentPatchSchema } from '@/lib/validation/payments'
import { z } from 'zod'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'

export async function GET() {
  try {
    const supabase = await createClient()
    await requireGlobalRole(supabase, 'admin')
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
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = paymentCreateSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dati pagamento non validi' }, { status: 400 })
    }
    const paymentData = parsed.data
    const supabase = await createClient()
    const account = await requireGlobalRole(supabase, 'admin')
    const adminClient = await createAdminClient()

    // Normalize payload to DB vocabulary and add auditing fields
    const normalized: any = {
      ...paymentData,
      status: paymentData?.status === 'to_pay' || !paymentData?.status ? 'pending' : paymentData.status,
      created_by: account.ownerProfileId,
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
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const parsed = paymentPatchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dati aggiornamento non validi' }, { status: 400 })
    }
    const { id, ...rawUpdate } = parsed.data
    const supabase = await createClient()
    await requireGlobalRole(supabase, 'admin')
    const adminClient = await createAdminClient()

    // Normalize incoming fields to satisfy DB constraints
    const updateData: any = { ...rawUpdate }
    if (typeof updateData.status === 'string') {
      // Map any legacy value to DB vocabulary
      if (updateData.status === 'to_pay') updateData.status = 'pending'
      if (!['pending', 'paid'].includes(updateData.status)) {
        // default to pending if unknown
        updateData.status = 'pending'
      }
    }
    if (typeof updateData.type === 'string') {
      if (updateData.type === 'general_cost') {
        updateData.coach_id = null
      } else if (updateData.type === 'coach_payment') {
        if (!updateData.coach_id) {
          return NextResponse.json({ error: 'coach_id richiesto per type=coach_payment' }, { status: 400 })
        }
      }
    }

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
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

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
    
    if (!id || !z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const supabase = await createClient()
    await requireGlobalRole(supabase, 'admin')
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
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
