import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { resetPasswordPayloadSchema } from '@/lib/validation/auth'
import { AccountContextError } from '@/server/auth/require-account-context'

export async function POST(req: Request) {
  try {
    const parsed = resetPasswordPayloadSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Password non valida' }, { status: 400 })
    }
    const { password } = parsed.data

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    // Aggiorna password e metadati server-controlled via Admin API.
    const admin = createAdminClient()
    const { data: account, error: accountLookupError } = await admin
      .from('app_accounts')
      .select('auth_user_id, status')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (accountLookupError) return NextResponse.json({ error: 'Impossibile verificare l’account' }, { status: 500 })
    if (!account) return NextResponse.json({ error: 'Account non collegato a una persona' }, { status: 403 })
    if (!['invited', 'active'].includes(account.status)) {
      return NextResponse.json({ error: 'Account non abilitato' }, { status: 403 })
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(user.id, {
      password,
      app_metadata: {
        ...user.app_metadata,
        must_change_password: false,
      },
    })
    if (updErr) {
      return NextResponse.json({ error: updErr.message || 'Errore aggiornamento password' }, { status: 400 })
    }

    const { error: accountUpdateError } = await admin
      .from('app_accounts')
      .update({
        must_change_password: false,
        status: account.status === 'invited' ? 'active' : account.status,
        activated_at: account.status === 'invited' ? new Date().toISOString() : undefined,
      })
      .eq('auth_user_id', account.auth_user_id)
    if (accountUpdateError) {
      return NextResponse.json({ error: 'Errore aggiornamento account' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json({ error: 'Errore inatteso' }, { status: 500 })
  }
}
