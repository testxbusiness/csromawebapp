import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { resetPasswordPayloadSchema } from '@/lib/validation/auth'
import { AccountContextError, requireAccountContext } from '@/server/auth/require-account-context'

export async function POST(req: Request) {
  try {
    const parsed = resetPasswordPayloadSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Password non valida' }, { status: 400 })
    }
    const { password } = parsed.data

    const supabase = await createClient()
    const account = await requireAccountContext(supabase)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    // Aggiorna password e metadati server-controlled via Admin API.
    const admin = createAdminClient()
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
      .update({ must_change_password: false })
      .eq('auth_user_id', account.authUserId)
    if (accountUpdateError) {
      return NextResponse.json({ error: 'Errore aggiornamento account' }, { status: 500 })
    }

    const { error: profileUpdateError } = await admin
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', account.ownerProfileId)
    if (profileUpdateError) {
      return NextResponse.json({ error: 'Errore aggiornamento profilo' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json({ error: 'Errore inatteso' }, { status: 500 })
  }
}
