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
    await sendToUser(account.ownerProfileId, {
      title: payload?.title || 'Notifica di test',
      body: payload?.body || 'Le push sono attive su questo dispositivo',
      url: payload?.url || '/dashboard',
      icon: payload?.icon || '/images/logo_CSRoma.png',
      badge: payload?.badge || '/favicon.ico',
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    if (e instanceof AccountContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error('test push error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
