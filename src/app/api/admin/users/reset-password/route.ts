import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { adminResetPasswordPayloadSchema } from '@/lib/validation/auth'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    const parsed = adminResetPasswordPayloadSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'ID utente non valido' }, { status: 400 })
    }
    const { user_id } = parsed.data

    // AuthN/AuthZ: only admin can reset
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

const role = (user as any)?.app_metadata?.role
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: profile, error: profileLookupError } = await adminClient
      .from('profiles')
      .select('email')
      .eq('id', user_id)
      .maybeSingle()

    if (profileLookupError || !profile?.email) {
      return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 })
    }

    const { data: authUserData, error: authUserLookupError } = await adminClient.auth.admin.getUserById(user_id)
    const currentAppMetadata = authUserData?.user?.app_metadata || {}
    const { error: metadataError } = authUserLookupError
      ? { error: authUserLookupError }
      : await adminClient.auth.admin.updateUserById(user_id, {
          app_metadata: { ...currentAppMetadata, must_change_password: true },
        })
    if (metadataError) {
      console.warn('Metadati auth non aggiornati:', metadataError)
    }

    // Mark profile to require password change
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({ must_change_password: true })
      .eq('id', user_id)

    if (profileError) {
      console.warn('Profilo non aggiornato (must_change_password):', profileError)
    }

    // The browser must initiate resetPasswordForEmail so Supabase can store the
    // PKCE verifier locally. Starting it from this server route produces a code
    // that the browser callback cannot exchange.
    return NextResponse.json({
      success: true,
      email: profile.email,
      message: 'Reset autorizzato: invio del link in corso.'
    })
  } catch (error) {
    console.error('Errore API reset password:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
