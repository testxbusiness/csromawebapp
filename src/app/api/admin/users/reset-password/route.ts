import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    const body = await request.json()
    const { user_id } = body || {}

    // AuthN/AuthZ: only admin can reset
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (user as any)?.user_metadata?.role
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!user_id) {
      return NextResponse.json({ error: 'user_id richiesto' }, { status: 400 })
    }

    // Reset password via admin API
    const { error: resetError } = await supabase.auth.admin.updateUserById(user_id, {
      password: 'csroma2025!',
      user_metadata: {
        must_change_password: true,
        temp_password_set_at: new Date().toISOString(),
        temp_password_expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString()
      }
    })

    if (resetError) {
      console.error('Errore reset password (auth):', resetError)
      return NextResponse.json({ error: 'Errore reset password' }, { status: 400 })
    }

    // Mark profile to require password change
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({ must_change_password: true })
      .eq('id', user_id)

    if (profileError) {
      console.warn('Profilo non aggiornato (must_change_password):', profileError)
    }

    return NextResponse.json({ success: true, message: 'Password resettata e cambio password richiesto al prossimo accesso.' })
  } catch (error) {
    console.error('Errore API reset password:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
