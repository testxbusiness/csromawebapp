import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AccountContextError, requireAccountContext } from '@/server/auth/require-account-context'

export async function GET() {
  try {
    const supabase = await createClient()
    const account = await requireAccountContext(supabase)
    if (!account.roles.includes('coach')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: assignments, error: assignmentError } = await supabase
      .from('team_coaches')
      .select('team_id')
      .eq('coach_id', account.ownerProfileId)
    if (assignmentError) throw assignmentError

    const teamIds = [...new Set((assignments ?? []).map((assignment) => assignment.team_id))]
    if (teamIds.length === 0) return NextResponse.json({ teams: [] })

    const { data: teams, error: teamError } = await supabase
      .from('teams')
      .select('id, name, code')
      .in('id', teamIds)
      .order('name')
    if (teamError) throw teamError

    return NextResponse.json({ teams: (teams ?? []).map((team) => ({
      id: team.id,
      name: team.name,
      code: team.code,
      activity: null,
    })) })
  } catch (error) {
    if (error instanceof AccountContextError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Coach teams API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
