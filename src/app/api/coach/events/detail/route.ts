import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { AccountContextError, requireAccountContext } from '@/server/auth/require-account-context'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const account = await requireAccountContext(supabase)
    if (!account.roles.includes('coach')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Verify access: event belongs to teams coached by user
    const { data: links } = await supabase
      .from('event_teams')
      .select('team_id')
      .eq('event_id', id)
    const teamIds = (links || []).map(l => l.team_id)
    if (teamIds.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const { data: allowed } = await supabase
      .from('team_coaches')
      .select('team_id')
      .in('team_id', teamIds)
      .eq('coach_id', account.ownerProfileId)
    if (!allowed || allowed.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Base event
    const { data: ev } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (!ev) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Enrich gym
    let gym: any = null
    if (ev.gym_id) {
      const { data } = await supabase.from('gyms').select('name, address, city').eq('id', ev.gym_id).maybeSingle()
      gym = data
    }
    // Teams names
    let teams: any[] = []
    if (teamIds.length) {
      const { data } = await supabase.from('teams').select('id, name, code').in('id', teamIds)
      teams = data || []
    }
    // Creator (via admin client to bypass profiles RLS)
    let creator: any = null
    if (ev.created_by) {
      const { data } = await admin.from('profiles').select('first_name, last_name').eq('id', ev.created_by).maybeSingle()
      creator = data
    }

    return NextResponse.json({
      id: ev.id,
      title: ev.title,
      description: ev.description,
      start_date: ev.start_date,
      end_date: ev.end_date,
      location: ev.location,
      event_type: ev.event_type,
      requires_confirmation: ev.requires_confirmation,
      confirmation_deadline: ev.confirmation_deadline,
      gym,
      teams,
      creator,
    })
  } catch (e) {
    if (e instanceof AccountContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
