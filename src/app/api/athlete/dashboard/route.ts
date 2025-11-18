import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (user as any)?.user_metadata?.role
    if (role !== 'athlete') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Execute all queries in parallel
    const [
      { data: seasons },
      { data: memberships },
      { data: msgRecipients },
      { data: feeInstallments }
    ] = await Promise.all([
      // 1. Get active season
      supabase
        .from('seasons')
        .select('*')
        .eq('is_active', true)
        .single()
        .catch(() => ({ data: null })),

      // 2. Get team memberships with team and activity info
      supabase
        .from('team_members')
        .select('id, team_id, jersey_number')
        .eq('profile_id', user.id),

      // 3. Get unread messages
      supabase
        .from('message_recipients')
        .select('message_id, is_read, created_at, messages(id, subject, content, created_at)')
        .or(`profile_id.eq.${user.id},team_id.in.(${[]})`)
        .order('created_at', { ascending: false })
        .limit(5),

      // 4. Get fee installments
      supabase
        .from('fee_installments')
        .select('id, installment_number, due_date, amount, status, membership_fee_id')
        .eq('profile_id', user.id)
        .limit(5)
    ])

    // Get team IDs
    const teamIds = [...new Set((memberships || []).map(m => m.team_id).filter(Boolean))]

    if (teamIds.length === 0) {
      return NextResponse.json({
        teamMemberships: [],
        upcomingEvents: [],
        unreadMessages: (msgRecipients || [])
          .filter(r => r.messages && !r.is_read)
          .map((r: any) => ({
            id: r.messages.id,
            subject: r.messages.subject,
            content: r.messages.content,
            created_at: r.messages.created_at,
            is_read: r.is_read
          }))
          .slice(0, 5),
        feeInstallments: [],
        activeSeason: seasons
      })
    }

    // Get teams, activities, events, and other data in parallel
    const [
      { data: teams },
      { data: eventTeamLinks },
      { data: membershipFees }
    ] = await Promise.all([
      supabase
        .from('teams')
        .select('id, name, code, activity_id')
        .in('id', teamIds),

      supabase
        .from('event_teams')
        .select('event_id, created_at')
        .in('team_id', teamIds)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(100),

      membershipFees && membershipFees.length > 0
        ? supabase
            .from('membership_fees')
            .select('id, team_id, name')
            .in('id', (feeInstallments || []).map(f => f.membership_fee_id).filter(Boolean))
        : Promise.resolve({ data: [] })
    ])

    // Get event IDs
    const eventIds = [...new Set((eventTeamLinks || []).map(l => l.event_id).filter(Boolean))]

    // Get events (with batch processing if needed)
    let allEvents: any[] = []
    if (eventIds.length > 0) {
      if (eventIds.length > 100) {
        for (let i = 0; i < eventIds.length; i += 100) {
          const batch = eventIds.slice(i, i + 100)
          const { data: events } = await supabase
            .from('events')
            .select('id, title, start_time:start_date, end_time:end_date, location, description')
            .in('id', batch)
          allEvents.push(...(events || []))
        }
      } else {
        const { data: events } = await supabase
          .from('events')
          .select('id, title, start_time:start_date, end_time:end_date, location, description')
          .in('id', eventIds)
          .gte('start_date', new Date().toISOString())
          .limit(10)
        allEvents = events || []
      }
    }

    // Get activities and enriched team data
    const activityIds = [...new Set((teams || []).map(t => t.activity_id).filter(Boolean))]
    const { data: activities } = activityIds.length > 0
      ? await supabase
          .from('activities')
          .select('id, name')
          .in('id', activityIds)
      : { data: [] }

    // Build enriched response
    const activitiesMap = new Map((activities || []).map(a => [a.id, a]))
    const teamsMap = new Map((teams || []).map(t => [t.id, t]))
    const membershipFeesMap = new Map((membershipFees || []).map(f => [f.id, f]))

    const enrichedMemberships = (memberships || [])
      .map(m => {
        const team = teamsMap.get(m.team_id)
        if (!team) return null
        return {
          id: m.id,
          jersey_number: m.jersey_number,
          team: {
            id: team.id,
            name: team.name,
            code: team.code,
            activity: {
              name: activitiesMap.get(team.activity_id)?.name || 'N/A'
            }
          }
        }
      })
      .filter(Boolean)

    const enrichedFees = (feeInstallments || [])
      .map(f => {
        const fee = membershipFeesMap.get(f.membership_fee_id)
        if (!fee) return null
        const feeTeam = teamsMap.get(fee.team_id)
        return {
          ...f,
          membership_fee: {
            name: fee.name,
            team: {
              name: feeTeam?.name || 'N/A'
            }
          }
        }
      })
      .filter(Boolean)

    const unreadMessages = (msgRecipients || [])
      .filter(r => r.messages && !r.is_read)
      .map((r: any) => ({
        id: r.messages.id,
        subject: r.messages.subject,
        content: r.messages.content,
        created_at: r.messages.created_at,
        is_read: r.is_read
      }))
      .slice(0, 5)

    return NextResponse.json({
      teamMemberships: enrichedMemberships,
      upcomingEvents: allEvents.slice(0, 10),
      unreadMessages,
      feeInstallments: enrichedFees,
      activeSeason: seasons
    })

  } catch (error) {
    console.error('Athlete dashboard API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
