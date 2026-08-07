import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pushSubscriptionSchema } from '@/lib/validation/messages'
import { AccountContextError, requireAccountContext } from '@/server/auth/require-account-context'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const account = await requireAccountContext(supabase)

    const parsed = pushSubscriptionSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
    const { endpoint, keys, user_agent, device_label } = parsed.data

    const { error } = await supabase.from('push_subscriptions').upsert({
      profile_id: account.ownerProfileId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: user_agent || req.headers.get('user-agent') || null,
      device_label: device_label || null,
      revoked: false,
      last_seen: new Date().toISOString(),
    }, { onConflict: 'profile_id,endpoint' })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (e) {
    if (e instanceof AccountContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error('subscribe error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
