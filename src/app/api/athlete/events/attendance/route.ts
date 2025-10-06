import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (user as any)?.user_metadata?.role
    if (role !== 'athlete') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const { event_id, status, note } = body || {}
    if (!event_id || !['going','maybe','declined'].includes(status)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const { error } = await supabase
      .from('event_attendances')
      .upsert({ event_id, profile_id: user.id, status, note: note || null }, { onConflict: 'event_id,profile_id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('RSVP error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

