import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const supabase = await createClient()

    // Parse query parameters
    const teams = searchParams.get('teams')?.split(',') || []
    const plans = searchParams.get('plans')?.split(',') || []
    const status = searchParams.get('status')?.split(',') || []
    const fromDate = searchParams.get('from')
    const toDate = searchParams.get('to')
    const search = searchParams.get('search') || ''
    const preset = searchParams.get('preset')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Calculate date range based on preset
    let dateFrom = fromDate
    let dateTo = toDate

    if (preset && !fromDate && !toDate) {
      const today = new Date()
      switch (preset) {
        case 'today':
          dateFrom = today.toISOString().split('T')[0]
          dateTo = dateFrom
          break
        case '7days':
          dateFrom = today.toISOString().split('T')[0]
          const in7Days = new Date(today)
          in7Days.setDate(today.getDate() + 7)
          dateTo = in7Days.toISOString().split('T')[0]
          break
        case '30days':
          dateFrom = today.toISOString().split('T')[0]
          const in30Days = new Date(today)
          in30Days.setDate(today.getDate() + 30)
          dateTo = in30Days.toISOString().split('T')[0]
          break
      }
    }

    // Build the query - show only installments assigned to athletes
    let query = supabase
      .from('fee_installments')
      .select(`
        *,
        profiles (id, first_name, last_name, email),
        membership_fees (id, name, team_id, teams (id, name, code))
      `)
      .not('profile_id', 'is', null)

    // Apply filters
    if (teams.length > 0) {
      // First get membership_fee IDs for the selected teams
      const { data: membershipFees } = await supabase
        .from('membership_fees')
        .select('id')
        .in('team_id', teams)

      if (membershipFees && membershipFees.length > 0) {
        const membershipFeeIds = membershipFees.map(mf => mf.id)
        query = query.in('membership_fee_id', membershipFeeIds)
      } else {
        // If no membership fees found for the teams, return empty result
        // Use a UUID that doesn't exist to ensure no results
        query = query.in('membership_fee_id', ['00000000-0000-0000-0000-000000000000'])
      }
    }

    if (plans.length > 0) {
      query = query.in('membership_fee_id', plans)
    }

    if (status.length > 0) {
      query = query.in('status', status)
    }

    if (dateFrom) {
      query = query.gte('due_date', dateFrom)
    }

    if (dateTo) {
      query = query.lte('due_date', dateTo)
    }

    if (search) {
      query = query.or(`profiles.first_name.ilike.%${search}%,profiles.last_name.ilike.%${search}%,profiles.email.ilike.%${search}%`)
    }

    // Get total count for pagination
    const { count, error: countError } = await query
    if (countError) {
      console.error('Errore count installments:', countError)
      return NextResponse.json({ error: 'Errore conteggio rate' }, { status: 500 })
    }

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1

    query = query.range(from, to).order('due_date', { ascending: true })

    // Execute query
    const { data: installments, error } = await query

    if (error) {
      console.error('Errore query installments:', error)
      return NextResponse.json({ error: 'Errore caricamento rate' }, { status: 500 })
    }

    // Transform data to include nested relationships
    const transformedInstallments = installments.map(installment => ({
      ...installment,
      profile: installment.profiles,
      membership_fee: installment.membership_fees,
      team: installment.membership_fees?.teams
    }))

    return NextResponse.json({
      installments: transformedInstallments,
      total: count || 0,
      page,
      limit
    })
  } catch (error) {
    console.error('Errore API installments:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}