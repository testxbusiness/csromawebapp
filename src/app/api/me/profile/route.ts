import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AccountContextError, requireAccountContext } from '@/server/auth/require-account-context'
import { finishRequestResponse, startRequestTiming } from '@/server/performance/request-timing'

export async function GET(request: Request) {
  const timing = startRequestTiming(request, '/api/me/profile')
  try {
    const supabase = await createClient()
    const contextStartedAt = timing?.now() ?? 0
    const account = await requireAccountContext(supabase)
    timing?.mark('account-context', contextStartedAt)

    const profileStartedAt = timing?.now() ?? 0
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', account.ownerProfileId)
      .maybeSingle()
    timing?.mark('profile-query', profileStartedAt)

    if (error) {
      return finishRequestResponse(NextResponse.json({ error: 'Impossibile caricare il profilo' }, { status: 500 }), timing)
    }

    if (!profile) {
      return finishRequestResponse(NextResponse.json({ error: 'Profilo non trovato' }, { status: 404 }), timing)
    }

    return finishRequestResponse(NextResponse.json({ profile, account }), timing)
  } catch (error) {
    if (error instanceof AccountContextError) {
      return finishRequestResponse(NextResponse.json({ error: error.message }, { status: error.status }), timing)
    }

    return finishRequestResponse(NextResponse.json({ error: 'Errore interno del server' }, { status: 500 }), timing)
  }
}
