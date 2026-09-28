import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'

interface BalanceFilters {
  seasonId?: string
  activityId?: string
  teamId?: string
  gymId?: string
  userId?: string
  startDate?: string
  endDate?: string
}

export async function GET(request: NextRequest) {
  try {
    // AuthZ: admin only
    const supabase = await createClient()
    await requireGlobalRole(supabase, 'admin')
    const { searchParams } = new URL(request.url)
    const filters: BalanceFilters = {
      seasonId: searchParams.get('seasonId') || undefined,
      activityId: searchParams.get('activityId') || undefined,
      teamId: searchParams.get('teamId') || undefined,
      gymId: searchParams.get('gymId') || undefined,
      userId: searchParams.get('userId') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined
    }

    const adminClient = await createAdminClient()
    
    const requestedSeasonId = filters.seasonId
    const showAllSeasons = requestedSeasonId === 'all'
    const { data: activeSeason } = await adminClient
      .from('seasons')
      .select('id, name, start_date, end_date, is_active')
      .eq('is_active', true)
      .maybeSingle()
    const selectedSeasonId = showAllSeasons ? null : requestedSeasonId || activeSeason?.id || null
    if (!showAllSeasons && !selectedSeasonId) {
      return NextResponse.json({ error: 'Nessuna stagione attiva trovata' }, { status: 400 })
    }
    let selectedSeason = showAllSeasons ? null : activeSeason

    if (selectedSeasonId && selectedSeasonId !== activeSeason?.id) {
      const { data: season, error: seasonError } = await adminClient
        .from('seasons')
        .select('id, name, start_date, end_date, is_active')
        .eq('id', selectedSeasonId)
        .maybeSingle()
      if (seasonError || !season) {
        return NextResponse.json({ error: 'Stagione non trovata' }, { status: 400 })
      }
      selectedSeason = season
    }

    // Get all activities for the current season first
    let seasonActivitiesQuery = adminClient
      .from('activities')
      .select('id')
    if (!showAllSeasons) {
      seasonActivitiesQuery = seasonActivitiesQuery.eq('season_id', selectedSeasonId as string)
    }
    const { data: seasonActivities, error: activitiesError } = await seasonActivitiesQuery

    if (activitiesError) {
      return NextResponse.json({ 
        error: 'Errore nel recupero delle attività',
        details: activitiesError.message
      }, { status: 500 })
    }

    const activityIds = seasonActivities?.map(a => a.id) || []

    // Build filter conditions
    let feesQuery = adminClient
      .from('membership_fees')
      .select(`
        id,
        total_amount,
        team_id,
        teams!inner(
          id,
          name,
          activity_id
        )
      `)

    if (!showAllSeasons) {
      feesQuery = feesQuery.in('teams.activity_id', activityIds.length ? activityIds : ['00000000-0000-0000-0000-000000000000'])
    }

    let paymentsQuery = adminClient
      .from('payments')
      .select(`
        id,
        type,
        amount,
        status,
        due_date,
        gym_id,
        activity_id,
        team_id,
        coach_id,
        gyms(id, name),
        activities(id, name),
        teams(id, name, code),
        coaches:profiles!payments_coach_id_fkey(id, first_name, last_name)
      `)

    // Apply filters
    if (filters.activityId) {
      feesQuery = feesQuery.eq('teams.activity_id', filters.activityId)
        paymentsQuery = paymentsQuery.eq('activity_id', filters.activityId)
    }
    
    if (filters.teamId) {
      feesQuery = feesQuery.eq('team_id', filters.teamId)
      paymentsQuery = paymentsQuery.eq('team_id', filters.teamId)
    }
    
    if (filters.gymId) {
      paymentsQuery = paymentsQuery.eq('gym_id', filters.gymId)
      // For fees, we need to handle gym filtering differently since we can't join activities directly
      // We'll filter fees based on team activities later in the processing
    }
    
    if (filters.userId) {
      paymentsQuery = paymentsQuery.eq('coach_id', filters.userId)
    }
    
    if (filters.startDate && filters.endDate) {
      paymentsQuery = paymentsQuery
        .gte('due_date', filters.startDate)
        .lte('due_date', filters.endDate)
    }

    // Execute queries
    const [{ data: feesData, error: feesError }, { data: payments, error: paymentsError }] = await Promise.all([
      feesQuery,
      paymentsQuery
    ])

    if (feesError || paymentsError) {
      return NextResponse.json({ 
        error: 'Errore nel recupero dei dati',
        details: feesError?.message || paymentsError?.message
      }, { status: 500 })
    }

    let filteredPayments = payments || []
    if (!showAllSeasons && selectedSeasonId) {
      const paymentTeamIds = [...new Set(filteredPayments.map((payment) => payment.team_id).filter(Boolean))]
      const paymentActivityIds = [...new Set(filteredPayments.map((payment) => payment.activity_id).filter(Boolean))]
      const paymentGymIds = [...new Set(filteredPayments.map((payment) => payment.gym_id).filter(Boolean))]
      const { data: paymentTeams } = paymentTeamIds.length
        ? await adminClient.from('teams').select('id, activity_id').in('id', paymentTeamIds)
        : { data: [] as { id: string; activity_id: string }[] }
      const allPaymentActivityIds = [...new Set([
        ...paymentActivityIds,
        ...(paymentTeams || []).map((team) => team.activity_id),
      ])]
      const [{ data: paymentActivities }, { data: paymentGyms }] = await Promise.all([
        allPaymentActivityIds.length ? adminClient.from('activities').select('id, season_id').in('id', allPaymentActivityIds) : Promise.resolve({ data: [] as { id: string; season_id: string }[] }),
        paymentGymIds.length ? adminClient.from('gyms').select('id, season_id').in('id', paymentGymIds) : Promise.resolve({ data: [] as { id: string; season_id: string }[] }),
      ])
      const activitySeasonById = new Map((paymentActivities || []).map((activity) => [activity.id, activity.season_id]))
      const teamSeasonById = new Map((paymentTeams || []).map((team) => [team.id, activitySeasonById.get(team.activity_id)]))
      const gymSeasonById = new Map((paymentGyms || []).map((gym) => [gym.id, gym.season_id]))
      filteredPayments = filteredPayments.filter((payment) => {
        if (payment.team_id) return teamSeasonById.get(payment.team_id) === selectedSeasonId
        if (payment.activity_id) return activitySeasonById.get(payment.activity_id) === selectedSeasonId
        if (payment.gym_id) return gymSeasonById.get(payment.gym_id) === selectedSeasonId
        return true
      })
    }

    // Handle gym filtering for fees if needed
    let filteredFeesData = feesData
    if (filters.gymId) {
      // Get activities that belong to the specified gym
      const { data: gymActivities } = await adminClient
        .from('activities')
        .select('id')
        .eq('gym_id', filters.gymId)
      
      const gymActivityIds = gymActivities?.map(a => a.id) || []
      
      // Filter fees to only include those where team's activity is in the gym
      filteredFeesData = feesData?.filter(fee =>
        fee.teams && gymActivityIds.includes((Array.isArray(fee.teams) ? fee.teams[0] : fee.teams)?.activity_id)
      ) || []
    }

    // Build installments query with filters
    let installmentsQuery = adminClient
      .from('fee_installments')
      .select(`
        id,
        amount,
        due_date,
        status,
        membership_fee_id,
        membership_fees!inner(
          id,
          team_id,
          teams!inner(
            id,
            activity_id
          )
        )
      `)

    // Apply activity filter to installments
    if (filters.activityId) {
      installmentsQuery = installmentsQuery.eq('membership_fees.teams.activity_id', filters.activityId)
    }
    
    // Apply team filter to installments
    if (filters.teamId) {
      installmentsQuery = installmentsQuery.eq('membership_fees.team_id', filters.teamId)
    }

    if (!showAllSeasons) {
      installmentsQuery = installmentsQuery.in('membership_fees.teams.activity_id', activityIds.length ? activityIds : ['00000000-0000-0000-0000-000000000000'])
    }

    const { data: installments, error: installmentsError } = await installmentsQuery

    if (installmentsError) {
      return NextResponse.json({ 
        error: 'Errore nel recupero delle rate',
        details: installmentsError.message
      }, { status: 500 })
    }

    // Handle gym filtering for installments if needed
    let filteredInstallments = installments
    if (filters.gymId) {
      // Get activities that belong to the specified gym
      const { data: gymActivities } = await adminClient
        .from('activities')
        .select('id')
        .eq('gym_id', filters.gymId)
      
      const gymActivityIds = gymActivities?.map(a => a.id) || []
      
      // Filter installments to only include those where team's activity is in the gym
      filteredInstallments = installments?.filter(installment =>
        (installment.membership_fees as any)?.[0]?.teams?.[0] &&
        gymActivityIds.includes((installment.membership_fees as any)[0].teams[0].activity_id)
      ) || []
    }

    // Calculate Actual (paid amounts)
    const actualIncome = filteredInstallments
      ?.filter(installment => installment.status === 'paid')
      ?.reduce((sum, installment) => sum + Number(installment.amount), 0) || 0

    const actualExpenses = filteredPayments
      ?.filter(payment => payment.status === 'paid')
      ?.reduce((sum, payment) => sum + Number(payment.amount), 0) || 0

    // Calculate Forecast (future due dates, not paid)
    const today = new Date().toISOString().split('T')[0]
    const forecastIncome = filteredInstallments
      ?.filter(installment => 
        installment.status !== 'paid' && 
        installment.due_date && 
        installment.due_date > today
      )
      ?.reduce((sum, installment) => sum + Number(installment.amount), 0) || 0

    const forecastExpenses = filteredPayments
      ?.filter(payment => 
        payment.status !== 'paid' && 
        payment.due_date && 
        payment.due_date > today
      )
      ?.reduce((sum, payment) => sum + Number(payment.amount), 0) || 0

    // Calculate Outstanding (past due dates, not paid)
    const outstandingIncome = filteredInstallments
      ?.filter(installment => 
        installment.status !== 'paid' && 
        installment.due_date && 
        installment.due_date <= today
      )
      ?.reduce((sum, installment) => sum + Number(installment.amount), 0) || 0

    const outstandingExpenses = filteredPayments
      ?.filter(payment => 
        payment.status !== 'paid' && 
        payment.due_date && 
        payment.due_date <= today
      )
      ?.reduce((sum, payment) => sum + Number(payment.amount), 0) || 0

    const balanceData = {
      season: selectedSeason,
      summary: {
        actual: {
          income: actualIncome,
          expenses: actualExpenses,
          balance: actualIncome - actualExpenses
        },
        forecast: {
          income: forecastIncome,
          expenses: forecastExpenses,
          balance: forecastIncome - forecastExpenses
        },
        outstanding: {
          income: outstandingIncome,
          expenses: outstandingExpenses,
          balance: outstandingIncome - outstandingExpenses
        },
        total: {
          income: actualIncome + forecastIncome + outstandingIncome,
          expenses: actualExpenses + forecastExpenses + outstandingExpenses,
          balance: (actualIncome + forecastIncome + outstandingIncome) - 
                   (actualExpenses + forecastExpenses + outstandingExpenses)
        }
      },
      details: {
        installments: installments || [],
        payments: filteredPayments
      }
    }

    return NextResponse.json(balanceData)

  } catch (error) {
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Error in balance API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
