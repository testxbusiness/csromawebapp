import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pushUnsubscribeSchema } from '@/lib/validation/messages'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const parsed = pushUnsubscribeSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })
    const { endpoint } = parsed.data

    const { error } = await supabase
      .from('push_subscriptions')
      .update({ revoked: true, last_seen: new Date().toISOString() })
      .eq('profile_id', user.id)
      .eq('endpoint', endpoint)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('unsubscribe error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
