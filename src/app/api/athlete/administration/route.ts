import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { noStoreJson } from '@/server/http/no-store'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireSubjectAthleteContext } from '@/server/auth/require-subject-profile'
import { loadAthleteAdministrationContract } from '@/server/athlete/administration'
import { finishRequestResponse, startRequestTiming } from '@/server/performance/request-timing'

export async function GET(request: NextRequest) {
  const timing = startRequestTiming(request, '/api/athlete/administration')
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const contextStartedAt = timing?.now() ?? 0
    const subject = await requireSubjectAthleteContext(supabase, searchParams.get('subjectProfileId'))
    timing?.mark('subject-context', contextStartedAt)
    const contractStartedAt = timing?.now() ?? 0
    const contract = await loadAthleteAdministrationContract(subject)
    timing?.mark('administration-contract', contractStartedAt)
    return finishRequestResponse(noStoreJson(contract), timing)
  } catch (error) {
    if (error instanceof AccountContextError) return finishRequestResponse(noStoreJson({ error: error.message }, error.status), timing)
    console.error('Errore API amministrazione atleta:', error)
    return finishRequestResponse(noStoreJson({ error: 'Errore interno del server' }, 500), timing)
  }
}
