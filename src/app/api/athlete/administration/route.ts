import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { noStoreJson } from '@/server/http/no-store'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireSubjectAthleteContext } from '@/server/auth/require-subject-profile'
import { loadAthleteAdministrationContract } from '@/server/athlete/administration'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const subject = await requireSubjectAthleteContext(supabase, searchParams.get('subjectProfileId'))
    return noStoreJson(await loadAthleteAdministrationContract(subject))
  } catch (error) {
    if (error instanceof AccountContextError) return noStoreJson({ error: error.message }, error.status)
    console.error('Errore API amministrazione atleta:', error)
    return noStoreJson({ error: 'Errore interno del server' }, 500)
  }
}
