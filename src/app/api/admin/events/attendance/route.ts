import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { eventIdQuerySchema } from '@/lib/validation/events'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    await requireGlobalRole(supabase, 'admin')
    const admin = createAdminClient()

    const { searchParams } = new URL(req.url)
    const parsed = eventIdQuerySchema.safeParse({ event_id: searchParams.get('event_id') })
    if (!parsed.success) return NextResponse.json({ error: 'Missing event_id' }, { status: 400 })
    const eventId = parsed.data.event_id

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
    if (e instanceof AccountContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
