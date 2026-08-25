import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pushUnsubscribeSchema } from '@/lib/validation/messages'
import { AccountContextError, requireAccountContext } from '@/server/auth/require-account-context'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const account = await requireAccountContext(supabase)

    const parsed = pushUnsubscribeSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })
    const { endpoint } = parsed.data

    const { error } = await supabase
      .from('push_subscriptions')
      .update({ revoked: true, last_seen: new Date().toISOString() })
      .eq('auth_user_id', account.authUserId)
      .eq('endpoint', endpoint)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (e) {
    if (e instanceof AccountContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error('unsubscribe error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
