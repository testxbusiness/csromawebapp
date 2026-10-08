import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireSubjectAthleteContext } from '@/server/auth/require-subject-profile'
import { loadAthleteFeesContract } from '@/server/athlete/fees'
import { finishRequestResponse, startRequestTiming } from '@/server/performance/request-timing'

export async function GET(request: NextRequest) {
  const timing = startRequestTiming(request, '/api/athlete/fees')
  try {
    const supabase = await createClient()

    const { searchParams } = new URL(request.url)
    const subject = timing
      ? await requireSubjectAthleteContext(supabase, searchParams.get('subjectProfileId'), 'view_payments', timing)
      : await requireSubjectAthleteContext(supabase, searchParams.get('subjectProfileId'), 'view_payments')
    const contractStartedAt = timing?.now() ?? 0
    const contract = await loadAthleteFeesContract(
      subject.dataClient,
      subject.profileId,
      subject.activeTeamIds ?? [],
    )
    timing?.mark('fees-contract', contractStartedAt)
    return finishRequestResponse(NextResponse.json(contract), timing)
  } catch (error) {
    if (error instanceof AccountContextError) {
      return finishRequestResponse(NextResponse.json({ error: error.message }, { status: error.status }), timing)
    }
    console.error('Athlete fees API error:', error)
    return finishRequestResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }), timing)
  }
}
