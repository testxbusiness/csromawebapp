import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const password: string | undefined = body?.password
    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'Password non valida' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) {
      return NextResponse.json({ error: 'Errore autenticazione' }, { status: 401 })
    }
    if (!user) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    // Aggiorna password e metadati via Admin API per evitare blocchi client-side
    const admin = createAdminClient()
    const { error: updErr } = await admin.auth.admin.updateUserById(user.id, {
      password,
      user_metadata: {
        must_change_password: false,
        temp_password_set_at: null,
        temp_password_expires_at: null,
      },
    })
    if (updErr) {
      return NextResponse.json({ error: updErr.message || 'Errore aggiornamento password' }, { status: 400 })
    }

    // Best effort: allinea anche il profilo (RLS bypassato lato server)
    try {
      await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('id', user.id)
    } catch {}

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Errore inatteso' }, { status: 500 })
  }
}

