import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AccountContextError, requireAccountContext } from '@/server/auth/require-account-context'

export async function GET() {
  try {
    const supabase = await createClient()
    const account = await requireAccountContext(supabase)
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', account.ownerProfileId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: 'Impossibile caricare il profilo' }, { status: 500 })
    }

    if (!profile) {
      return NextResponse.json({ error: 'Profilo non trovato' }, { status: 404 })
    }

    return NextResponse.json({ profile, account })
  } catch (error) {
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
