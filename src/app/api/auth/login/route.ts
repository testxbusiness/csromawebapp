import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email e password sono obbligatori' }, { status: 400 })
    }

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

    let profile = null
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single()

      if (!profileError && profileData) {
        profile = profileData
        console.log('Profile prefetched during login')
      }
    } catch (err) {
      console.warn('Profile prefetch failed, will load on client:', err)
    }

    return NextResponse.json({
      success: true,
      user: authData.user,
      profile,
      session: authData.session,
    })
  } catch (error) {
    console.error('Login exception:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
