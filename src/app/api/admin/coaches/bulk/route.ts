import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const requesterRole = (user as any)?.user_metadata?.role
    if (requesterRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { operation, coachIds, parameters, dryRun = false } = body

    if (!operation || !coachIds || !Array.isArray(coachIds)) {
      return NextResponse.json({ error: 'Parametri mancanti o non validi' }, { status: 400 })
    }

    // Gestione operazioni massive
    switch (operation) {
      case 'assign_to_team':
        return await handleTeamAssignment(adminClient, coachIds, parameters, dryRun)

      case 'remove_from_team':
        return await handleTeamRemoval(adminClient, coachIds, parameters, dryRun)

      case 'update_staff_role':
        return await handleRoleUpdate(adminClient, coachIds, parameters, dryRun)

      default:
        return NextResponse.json({ error: 'Operazione non supportata' }, { status: 400 })
    }
  } catch (error) {
    console.error('Errore API operazioni massive collaboratori:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

// Funzioni helper per operazioni massive
async function handleTeamAssignment(adminClient: any, coachIds: string[], parameters: any, dryRun: boolean) {
  const { teamIds, role = 'assistant_coach' } = parameters

  if (!teamIds || !Array.isArray(teamIds) || teamIds.length === 0) {
    return NextResponse.json({ error: 'ID squadre mancanti o non validi' }, { status: 400 })
  }

  // Verifica che tutte le squadre esistano
  const { data: teams, error: teamsError } = await adminClient
    .from('teams')
    .select('id, name')
    .in('id', teamIds)

  if (teamsError || !teams || teams.length !== teamIds.length) {
    return NextResponse.json({ error: 'Una o più squadre non trovate' }, { status: 404 })
  }

  const teamNames = teams.map(team => team.name).join(', ')

  if (dryRun) {
    return NextResponse.json({
      message: `DRY RUN: ${coachIds.length} collaboratori verrebbero assegnati alle squadre "${teamNames}" con ruolo "${role}"`,
      operation: 'assign_to_team',
      affected: coachIds.length,
      parameters: { teamIds, teamNames, role }
    })
  }

  // Assegna i collaboratori alle squadre
  const assignments = []
  for (const coachId of coachIds) {
    for (const teamId of teamIds) {
      assignments.push({
        coach_id: coachId,
        team_id: teamId,
        role: role,
        assigned_at: new Date().toISOString()
      })
    }
  }

  const { data, error } = await adminClient
    .from('team_coaches')
    .upsert(assignments, { onConflict: 'team_id,coach_id' })

  if (error) {
    console.error('Errore assegnazione collaboratori:', error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({
    message: `${coachIds.length} collaboratori assegnati alle squadre "${teamNames}" con ruolo "${role}"`,
    operation: 'assign_to_team',
    affected: coachIds.length,
    teamNames: teamNames,
    role
  })
}

async function handleTeamRemoval(adminClient: any, coachIds: string[], parameters: any, dryRun: boolean) {
  const { teamId, teamIds } = parameters

  // Support sia teamId (singolo) che teamIds (multiplo) per retrocompatibilità
  const targetTeamIds = teamIds || (teamId ? [teamId] : [])

  if (!targetTeamIds.length) {
    return NextResponse.json({ error: 'ID squadra mancanti' }, { status: 400 })
  }

  // Verifica che tutte le squadre esistano
  const { data: teams, error: teamsError } = await adminClient
    .from('teams')
    .select('id, name')
    .in('id', targetTeamIds)

  if (teamsError || !teams || teams.length !== targetTeamIds.length) {
    return NextResponse.json({ error: 'Una o più squadre non trovate' }, { status: 404 })
  }

  const teamNames = teams.map(team => team.name).join(', ')

  if (dryRun) {
    return NextResponse.json({
      message: `DRY RUN: ${coachIds.length} collaboratori verrebbero rimossi dalle squadre "${teamNames}"`,
      operation: 'remove_from_team',
      affected: coachIds.length,
      parameters: { teamIds: targetTeamIds, teamNames }
    })
  }

  // Rimuovi i collaboratori dalle squadre
  const { error } = await adminClient
    .from('team_coaches')
    .delete()
    .in('coach_id', coachIds)
    .in('team_id', targetTeamIds)

  if (error) {
    console.error('Errore rimozione collaboratori:', error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({
    message: `${coachIds.length} collaboratori rimossi dalle squadre "${teamNames}"`,
    operation: 'remove_from_team',
    affected: coachIds.length,
    teamNames: teamNames
  })
}

async function handleRoleUpdate(adminClient: any, coachIds: string[], parameters: any, dryRun: boolean) {
  const { role } = parameters

  if (!role || !['head_coach', 'assistant_coach'].includes(role)) {
    return NextResponse.json({ error: 'Ruolo non valido' }, { status: 400 })
  }

  if (dryRun) {
    return NextResponse.json({
      message: `DRY RUN: ${coachIds.length} collaboratori avrebbero il ruolo aggiornato a "${role}"`,
      operation: 'update_staff_role',
      affected: coachIds.length,
      parameters: { role }
    })
  }

  // Aggiorna il ruolo dei collaboratori nelle loro squadre
  const { error } = await adminClient
    .from('team_coaches')
    .update({ role: role })
    .in('coach_id', coachIds)

  if (error) {
    console.error('Errore aggiornamento ruolo:', error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({
    message: `${coachIds.length} collaboratori aggiornati con ruolo "${role}"`,
    operation: 'update_staff_role',
    affected: coachIds.length,
    role
  })
}