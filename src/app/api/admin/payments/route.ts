import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { sendToUser } from '@/lib/utils/push'
import { paymentCreateSchema, paymentPatchSchema } from '@/lib/validation/payments'
import { z } from 'zod'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'

type PaymentPayeeType = 'coach' | 'staff'

async function getPaymentPayeeType(
  adminClient: ReturnType<typeof createAdminClient>,
  profileId: string,
): Promise<PaymentPayeeType | null> {
  const [{ data: payee }, { data: account }] = await Promise.all([
    adminClient
      .from('profiles')
      .select('id, coach_profiles(profile_id), season_profiles(profile_type)')
      .eq('id', profileId)
      .maybeSingle(),
    adminClient
      .from('app_accounts')
      .select('auth_user_id')
      .eq('owner_profile_id', profileId)
      .maybeSingle(),
  ])

  const { data: accountRoles } = account?.auth_user_id
    ? await adminClient
        .from('account_roles')
        .select('role')
        .eq('auth_user_id', account.auth_user_id)
    : { data: [] }

  const hasCoachProfile = Array.isArray(payee?.coach_profiles)
    ? payee.coach_profiles.length > 0
    : Boolean(payee?.coach_profiles)
  const seasonTypes = (payee?.season_profiles ?? []).map(
    (row: { profile_type: string | null }) => row.profile_type,
  )

  const hasCoachAccountRole = (accountRoles ?? []).some((row: { role: string }) => row.role === 'coach')
  const hasStaffSeasonType = seasonTypes.includes('staff')
  const hasCoachSeasonType = seasonTypes.includes('coach')

  if (hasCoachAccountRole || hasCoachProfile || hasCoachSeasonType) return 'coach'
  if (hasStaffSeasonType) return 'staff'
  return null
}

async function paymentMatchesSeason(
  adminClient: ReturnType<typeof createAdminClient>,
  payload: { team_id?: string | null; activity_id?: string | null; gym_id?: string | null },
  seasonId?: string | null,
) {
  if (!seasonId) return true
  const seasons: string[] = []

  if (payload.activity_id) {
    const { data } = await adminClient.from('activities').select('season_id').eq('id', payload.activity_id).maybeSingle()
    if (!data) return false
    seasons.push(data.season_id)
  }
  if (payload.team_id) {
    const { data: team } = await adminClient.from('teams').select('activity_id').eq('id', payload.team_id).maybeSingle()
    if (!team) return false
    const { data: activity } = await adminClient.from('activities').select('season_id').eq('id', team.activity_id).maybeSingle()
    if (!activity) return false
    seasons.push(activity.season_id)
  }
  if (payload.gym_id) {
    const { data } = await adminClient.from('gyms').select('season_id').eq('id', payload.gym_id).maybeSingle()
    if (!data) return false
    seasons.push(data.season_id)
  }

  return seasons.every((value) => value === seasonId)
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    await requireGlobalRole(supabase, 'admin')
    const adminClient = await createAdminClient()
    
    const seasonId = new URL(request.url).searchParams.get('season_id')
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
        payees:profiles!payments_payee_profile_id_fkey (
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

    let filteredData = data || []
    if (seasonId) {
      const teamIds = [...new Set(filteredData.map((payment) => payment.team_id).filter(Boolean))]
      const activityIds = [...new Set(filteredData.map((payment) => payment.activity_id).filter(Boolean))]
      const gymIds = [...new Set(filteredData.map((payment) => payment.gym_id).filter(Boolean))]
      const [{ data: teams }, { data: activities }, { data: gyms }] = await Promise.all([
        teamIds.length ? adminClient.from('teams').select('id, activity_id').in('id', teamIds) : Promise.resolve({ data: [] as { id: string; activity_id: string }[] }),
        activityIds.length ? adminClient.from('activities').select('id, season_id').in('id', activityIds) : Promise.resolve({ data: [] as { id: string; season_id: string }[] }),
        gymIds.length ? adminClient.from('gyms').select('id, season_id').in('id', gymIds) : Promise.resolve({ data: [] as { id: string; season_id: string }[] }),
      ])
      const activitySeasonById = new Map((activities || []).map((activity) => [activity.id, activity.season_id]))
      const teamSeasonById = new Map((teams || []).map((team) => [team.id, activitySeasonById.get(team.activity_id)]))
      const gymSeasonById = new Map((gyms || []).map((gym) => [gym.id, gym.season_id]))
      filteredData = filteredData.filter((payment) => {
        if (payment.team_id) return teamSeasonById.get(payment.team_id) === seasonId
        if (payment.activity_id) return activitySeasonById.get(payment.activity_id) === seasonId
        if (payment.gym_id) return gymSeasonById.get(payment.gym_id) === seasonId
        return true
      })
    }

    return NextResponse.json(filteredData)
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
    const { season_id: seasonId, ...paymentData } = parsed.data
    const supabase = await createClient()
    const account = await requireGlobalRole(supabase, 'admin')
    const adminClient = await createAdminClient()
    if (!(await paymentMatchesSeason(adminClient, paymentData, seasonId))) {
      return NextResponse.json({ error: 'Il pagamento non appartiene alla stagione selezionata' }, { status: 400 })
    }

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
      normalized.payee_profile_id = null
    } else if (normalized?.type === 'coach_payment') {
      // Coach payments must have a coach_id
      if (!normalized?.coach_id) {
        return NextResponse.json({ error: 'coach_id richiesto per type=coach_payment' }, { status: 400 })
      }
      normalized.payee_profile_id = null
    } else if (normalized?.type === 'person_payment') {
      if (!normalized?.payee_profile_id) {
        return NextResponse.json({ error: 'payee_profile_id richiesto per type=person_payment' }, { status: 400 })
      }
      normalized.coach_id = null

      if ((await getPaymentPayeeType(adminClient, normalized.payee_profile_id)) !== 'staff') {
        return NextResponse.json({ error: 'Il destinatario deve essere uno staff' }, { status: 400 })
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
    const { id, season_id: seasonId, ...rawUpdate } = parsed.data
    const supabase = await createClient()
    await requireGlobalRole(supabase, 'admin')
    const adminClient = await createAdminClient()
    if (!(await paymentMatchesSeason(adminClient, rawUpdate, seasonId))) {
      return NextResponse.json({ error: 'Il pagamento non appartiene alla stagione selezionata' }, { status: 400 })
    }

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
        updateData.payee_profile_id = null
      } else if (updateData.type === 'coach_payment') {
        if (!updateData.coach_id) {
          return NextResponse.json({ error: 'coach_id richiesto per type=coach_payment' }, { status: 400 })
        }
        updateData.payee_profile_id = null
      } else if (updateData.type === 'person_payment') {
        if (!updateData.payee_profile_id) {
          return NextResponse.json({ error: 'payee_profile_id richiesto per type=person_payment' }, { status: 400 })
        }
        if ((await getPaymentPayeeType(adminClient, updateData.payee_profile_id)) !== 'staff') {
          return NextResponse.json({ error: 'Il destinatario deve essere uno staff' }, { status: 400 })
        }
        updateData.coach_id = null
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
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
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
