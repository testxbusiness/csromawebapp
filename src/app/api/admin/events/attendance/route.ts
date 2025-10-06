import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (user as any)?.user_metadata?.role
    if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const eventId = searchParams.get('event_id')
    if (!eventId) return NextResponse.json({ error: 'Missing event_id' }, { status: 400 })

    // Fetch teams attached to event
    const { data: links } = await admin.from('event_teams').select('team_id').eq('event_id', eventId)
    const teamIds = (links || []).map((l: any) => l.team_id)
    const { data: members } = await admin
      .from('team_members')
      .select('profile_id, profiles(id, first_name, last_name, email)')
      .in('team_id', teamIds)

    const allProfiles = (members || []).map((m: any) => m.profiles).filter(Boolean)
    const { data: atts } = await admin
      .from('event_attendances')
      .select('profile_id, status, responded_at, profiles(first_name,last_name,email)')
      .eq('event_id', eventId)

    const byId = new Map((atts || []).map((a: any) => [a.profile_id, a]))
    const going: any[] = []
    const maybe: any[] = []
    const declined: any[] = []
    const noResp: any[] = []
    for (const p of allProfiles) {
      const a = byId.get(p.id)
      if (!a) noResp.push(p)
      else if (a.status === 'going') going.push(a)
      else if (a.status === 'maybe') maybe.push(a)
      else declined.push(a)
    }
    return NextResponse.json({
      going, maybe, declined, no_response: noResp,
      counts: { going: going.length, maybe: maybe.length, declined: declined.length, no_response: noResp.length }
    })
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

