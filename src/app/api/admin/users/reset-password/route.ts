import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { adminResetPasswordPayloadSchema } from '@/lib/validation/auth'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const parsed = adminResetPasswordPayloadSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'ID utente non valido' }, { status: 400 })
    }
    const { user_id } = parsed.data

    await requireGlobalRole(supabase, 'admin')
    const adminClient = createAdminClient()

    const { data: accountByProfile, error: accountByProfileError } = await adminClient
      .from('app_accounts')
      .select('auth_user_id, owner_profile_id')
      .eq('owner_profile_id', user_id)
      .maybeSingle()

    if (accountByProfileError) {
      return NextResponse.json({ error: 'Impossibile verificare l’account' }, { status: 500 })
    }

    const { data: account, error: accountLookupError } = accountByProfile
      ? { data: accountByProfile, error: null }
      : await adminClient
          .from('app_accounts')
          .select('auth_user_id, owner_profile_id')
          .eq('auth_user_id', user_id)
          .maybeSingle()

    if (accountLookupError) {
      return NextResponse.json({ error: 'Impossibile verificare l’account' }, { status: 500 })
    }
    if (!account) {
      return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 })
    }

    const { data: profile, error: profileLookupError } = await adminClient
      .from('profiles')
      .select('email')
      .eq('id', account.owner_profile_id)
      .maybeSingle()

    if (profileLookupError) {
      return NextResponse.json({ error: 'Impossibile verificare l’account' }, { status: 500 })
    }

    const { data: authUserData, error: authUserLookupError } = await adminClient.auth.admin.getUserById(account.auth_user_id)
    if (authUserLookupError || !authUserData.user) {
      return NextResponse.json({ error: 'Utente Auth non trovato' }, { status: 404 })
    }
    const email = authUserData.user.email || profile?.email
    if (!email) {
      return NextResponse.json({ error: 'Email utente non disponibile' }, { status: 404 })
    }

    const currentAppMetadata = authUserData?.user?.app_metadata || {}
    const { error: metadataError } = await adminClient.auth.admin.updateUserById(account.auth_user_id, {
      app_metadata: { ...currentAppMetadata, must_change_password: true },
    })
    if (metadataError) {
      return NextResponse.json({ error: 'Impossibile autorizzare il reset password' }, { status: 500 })
    }

    const { error: accountError } = await adminClient
      .from('app_accounts')
      .update({ must_change_password: true })
      .eq('auth_user_id', account.auth_user_id)

    if (accountError) {
      return NextResponse.json({ error: 'Impossibile aggiornare lo stato account' }, { status: 500 })
    }

    // The browser must initiate resetPasswordForEmail so Supabase can store the
    // PKCE verifier locally. Starting it from this server route produces a code
    // that the browser callback cannot exchange.
    return NextResponse.json({
      success: true,
      email,
      message: 'Reset autorizzato: invio del link in corso.'
    })
  } catch (error) {
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Errore API reset password:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
