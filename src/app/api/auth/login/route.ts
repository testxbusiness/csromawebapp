import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { email, password } = body || {}

    if (typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Email e password sono richieste' }, { status: 400 })
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status || 400 })
    }

    return NextResponse.json({ user: data.user })
  } catch (e) {
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

