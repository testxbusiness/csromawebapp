import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireSubjectAthleteContext } from '@/server/auth/require-subject-profile'
import { loadAthleteTeamDetail } from '@/server/athlete/team-detail'
import { noStoreJson } from '@/server/http/no-store'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('id')
    if (!teamId) return noStoreJson({ error: 'Missing id' }, 400)
    const supabase = await createClient()
    const subject = await requireSubjectAthleteContext(supabase, searchParams.get('subjectProfileId'), 'view_schedule')
    return noStoreJson(await loadAthleteTeamDetail(subject, teamId))
  } catch (error) {
    if (error instanceof AccountContextError) return noStoreJson({ error: error.message }, error.status)
    console.error('Errore endpoint dettaglio squadra atleta:', error)
    return noStoreJson({ error: 'Impossibile caricare il dettaglio della squadra' }, 500)
  }
}
