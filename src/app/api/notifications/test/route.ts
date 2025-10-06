import { NextRequest, NextResponse } from 'next/server'
import { sendToUser } from '@/lib/utils/push'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const payload = await req.json().catch(() => ({}))
    await sendToUser(user.id, {
      title: payload?.title || 'Notifica di test',
      body: payload?.body || 'Le push sono attive su questo dispositivo',
      url: payload?.url || '/dashboard',
      icon: payload?.icon || '/images/logo_CSRoma.png',
      badge: payload?.badge || '/favicon.ico',
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('test push error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

