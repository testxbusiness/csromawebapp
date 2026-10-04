import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireSubjectAthleteContext } from '@/server/auth/require-subject-profile'
import { loadAthleteFeesContract } from '@/server/athlete/fees'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { searchParams } = new URL(request.url)
    const subject = await requireSubjectAthleteContext(supabase, searchParams.get('subjectProfileId'), 'view_payments')
    const contract = await loadAthleteFeesContract(
      subject.dataClient,
      subject.profileId,
      subject.activeTeamIds ?? [],
    )
    return NextResponse.json(contract)
  } catch (error) {
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Athlete fees API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
