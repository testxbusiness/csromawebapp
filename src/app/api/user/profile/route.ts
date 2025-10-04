import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { must_change_password } = body
    if (typeof must_change_password !== 'boolean') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    // Verifica autenticazione
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Aggiorna il profilo usando RLS (policy self-or-admin attiva)
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ must_change_password })
      .eq('id', user.id)

    if (profileError) {
      console.error('Errore aggiornamento profilo:', profileError)
      return NextResponse.json({ error: 'Errore aggiornamento profilo' }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Profilo aggiornato con successo'
    })

  } catch (error) {
    console.error('Errore API aggiornamento profilo:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
