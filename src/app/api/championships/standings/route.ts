import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient, createClient } from '@/lib/supabase/server'

const groupIdSchema = z.string().uuid()

export async function GET(request: NextRequest) {
  try {
    const groupId = groupIdSchema.safeParse(new URL(request.url).searchParams.get('group_id'))
    if (!groupId.success) {
      return NextResponse.json({ standings: [] }, { status: 200 })
    }

    const supabase = await createClient()
    const admin = createAdminClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ standings: [] }, { status: 200 })
    }

    const role = String(user.app_metadata?.role ?? '').toLowerCase()
    if (!['admin', 'coach', 'athlete'].includes(role)) {
      return NextResponse.json({ standings: [] }, { status: 200 })
    }

    if (role !== 'admin') {
      const { data: groupTeams, error: groupTeamsError } = await admin
        .from('championship_group_teams')
        .select('championship_club_team_id')
        .eq('championship_group_id', groupId.data)

      if (groupTeamsError || !groupTeams?.length) {
        return NextResponse.json({ standings: [] }, { status: 200 })
      }

      const clubTeamIds = groupTeams.map((groupTeam) => groupTeam.championship_club_team_id)
      const { data: clubTeams, error: clubTeamsError } = await admin
        .from('championship_club_teams')
        .select('team_id')
        .in('id', clubTeamIds)

      if (clubTeamsError || !clubTeams?.length) {
        return NextResponse.json({ standings: [] }, { status: 200 })
      }

      const teamIds = clubTeams
        .map((clubTeam) => clubTeam.team_id)
        .filter((teamId): teamId is string => Boolean(teamId))

      if (!teamIds.length) {
        return NextResponse.json({ standings: [] }, { status: 200 })
      }

      const relation = role === 'coach' ? 'team_coaches' : 'team_members'
      const profileColumn = role === 'coach' ? 'coach_id' : 'profile_id'
      const { data: assignments, error: assignmentsError } = await admin
        .from(relation)
        .select('team_id')
        .in('team_id', teamIds)
        .eq(profileColumn, user.id)

      if (assignmentsError || !assignments?.length) {
        return NextResponse.json({ standings: [] }, { status: 200 })
      }
    }

    const { data: standings, error: standingsError } = await admin
      .from('championship_standings_mv')
      .select('*')
      .eq('championship_group_id', groupId.data)

    if (standingsError) {
      console.error('Errore caricamento classifica:', standingsError)
      return NextResponse.json({ error: 'Impossibile caricare la classifica' }, { status: 500 })
    }

    return NextResponse.json({ standings: standings ?? [] }, { status: 200 })
  } catch (error) {
    console.error('Errore endpoint classifica:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
