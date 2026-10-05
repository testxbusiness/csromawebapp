import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { noStoreJson } from '@/server/http/no-store'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireSubjectAthleteContext } from '@/server/auth/require-subject-profile'
import { loadAthleteDashboardAdministrativeAlerts } from '@/server/athlete/administration'
import { finishRequestResponse, startRequestTiming } from '@/server/performance/request-timing'

export async function GET(request: NextRequest) {
  const timing = startRequestTiming(request, '/api/athlete/dashboard/alerts')
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const contextStartedAt = timing?.now() ?? 0
    const subject = await requireSubjectAthleteContext(supabase, searchParams.get('subjectProfileId'))
    timing?.mark('subject-context', contextStartedAt)

    const alertsStartedAt = timing?.now() ?? 0
    const administrativeAlerts = await loadAthleteDashboardAdministrativeAlerts(subject)
    timing?.mark('administrative-alerts', alertsStartedAt)

    return finishRequestResponse(noStoreJson({ administrativeAlerts }), timing)
  } catch (error) {
    if (error instanceof AccountContextError) {
      return finishRequestResponse(noStoreJson({ error: error.message }, error.status), timing)
    }
    console.error('Errore alert amministrativi dashboard atleta:', error)
    return finishRequestResponse(noStoreJson({ error: 'Errore interno del server' }, 500), timing)
  }
}
