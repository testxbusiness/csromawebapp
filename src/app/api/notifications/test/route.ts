import { NextRequest, NextResponse } from 'next/server'
import { sendToUser } from '@/lib/utils/push'
import { createClient } from '@/lib/supabase/server'
import { pushTestSchema } from '@/lib/validation/messages'
import { AccountContextError, requireAccountContext } from '@/server/auth/require-account-context'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const account = await requireAccountContext(supabase)

    const parsed = pushTestSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: 'Notifica non valida' }, { status: 400 })
    const payload = parsed.data
    const result = await sendToUser(account.ownerProfileId, {
      title: payload?.title || 'Notifica di test',
      body: payload?.body || 'Le push sono attive su questo dispositivo',
      url: payload?.url || '/dashboard',
      icon: payload?.icon || '/icons/icon-192.png',
      badge: payload?.badge || '/icons/icon-192.png',
    })
    if (result.skipped) {
      return NextResponse.json({ success: false, error: result.reason }, { status: 503 })
    }
    if (result.subscriptions === 0) {
      return NextResponse.json({ success: false, error: 'Nessuna subscription push attiva per questo account' }, { status: 404 })
    }
    if (result.sent === 0) {
      return NextResponse.json({ success: false, error: 'Invio push fallito', failed: result.failed }, { status: 502 })
    }
    return NextResponse.json({ success: true, sent: result.sent, failed: result.failed })
  } catch (e) {
    if (e instanceof AccountContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error('test push error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
