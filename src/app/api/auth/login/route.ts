import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loginPayloadSchema } from '@/lib/validation/auth'
import {
  AccountContext,
  AccountContextError,
  requireAccountContext,
} from '@/server/auth/require-account-context'

export async function POST(request: NextRequest) {
  try {
    const parsed = loginPayloadSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Email e password non validi' }, { status: 400 })
    }
    const { email, password } = parsed.data

    const supabase = await createClient()

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      console.error('Login error:', authError)
      return NextResponse.json({ error: 'Credenziali non valide' }, { status: 401 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Autenticazione fallita' }, { status: 401 })
    }

    let account: AccountContext
    try {
      account = await requireAccountContext(supabase)
    } catch (error) {
      await supabase.auth.signOut()
      throw error
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', account.ownerProfileId)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      user: authData.user,
      profile,
      account,
      session: authData.session,
    })
  } catch (error) {
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Login exception:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
