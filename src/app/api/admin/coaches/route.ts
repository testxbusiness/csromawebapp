import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET() {
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

    // Carica collaboratori con dettagli base (solo dati profilo)
    const { data: coaches, error } = await adminClient
      .from('profiles')
      .select(`
        id,
        email,
        first_name,
        last_name,
        phone,
        birth_date,
        created_at,
        updated_at
      `)
      .eq('role', 'coach')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Errore caricamento collaboratori:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (!coaches || coaches.length === 0) {
      return NextResponse.json({ coaches: [] })
    }

    // Carica profili coach separatamente
    const coachIds = coaches.map(c => c.id)
    const { data: coachProfiles } = await adminClient
      .from('coach_profiles')
      .select('profile_id, level, specialization, started_on')
      .in('profile_id', coachIds)

    // Carica team coaches separatamente - recupera tutti e poi filtra
    const { data: allTeamCoaches, error: teamCoachesError } = await adminClient
      .from('team_coaches')
      .select('coach_id, team_id, role, assigned_at')

    if (teamCoachesError) {
      console.error('Errore caricamento team_coaches:', teamCoachesError)
    }

    // Filtra lato JavaScript per evitare "URI too long"
    const teamCoaches = allTeamCoaches?.filter(tc =>
      coachIds.includes(tc.coach_id)
    ) || []

    // Carica dettagli squadre separatamente - recupera tutte e poi filtra
    const teamIds = teamCoaches?.map(tc => tc.team_id).filter(Boolean) || []

    const { data: allTeams, error: teamsError } = await adminClient
      .from('teams')
      .select('id, name, code, activity_id')

    if (teamsError) {
      console.error('Errore caricamento squadre:', teamsError)
    }

    // Filtra lato JavaScript per evitare "URI too long"
    const teams = allTeams?.filter(team =>
      teamIds.includes(team.id)
    ) || []

    // Formatta i dati per il frontend
    const formattedCoaches = coaches.map(coach => {
      const coachProfile = coachProfiles?.find(cp => cp.profile_id === coach.id) || {}
      const coachTeamAssignments = teamCoaches?.filter(tc => tc.coach_id === coach.id) || []

      const teamsWithDetails = coachTeamAssignments.map(assignment => {
        const team = teams?.find(t => t.id === assignment.team_id)
        return {
          id: assignment.team_id,
          name: team?.name || 'Squadra sconosciuta',
          role: assignment.role,
          assigned_at: assignment.assigned_at,
          activity_id: team?.activity_id
        }
      })

      const coachData = {
        id: coach.id,
        email: coach.email,
        first_name: coach.first_name,
        last_name: coach.last_name,
        phone: coach.phone,
        birth_date: coach.birth_date,
        level: coachProfile.level,
        specialization: coachProfile.specialization,
        started_on: coachProfile.started_on,
        created_at: coach.created_at,
        updated_at: coach.updated_at,
        teams: teamsWithDetails.filter(team => team.id)
      }

      return coachData
    })

    return NextResponse.json({ coaches: formattedCoaches })
  } catch (error) {
    console.error('Errore API lista collaboratori:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

// API per operazioni massive sui collaboratori
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
    const { operation, coachIds, parameters } = body

    if (!operation || !coachIds || !Array.isArray(coachIds)) {
      return NextResponse.json({ error: 'Parametri mancanti o non validi' }, { status: 400 })
    }

    // Gestione operazioni massive
    switch (operation) {
      case 'assign_to_team':
        return await handleTeamAssignment(adminClient, coachIds, parameters)

      case 'remove_from_team':
        return await handleTeamRemoval(adminClient, coachIds, parameters)

      case 'update_staff_role':
        return await handleRoleUpdate(adminClient, coachIds, parameters)

      default:
        return NextResponse.json({ error: 'Operazione non supportata' }, { status: 400 })
    }
  } catch (error) {
    console.error('Errore API operazioni massive collaboratori:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

// Funzioni helper per operazioni massive
async function handleTeamAssignment(adminClient: any, coachIds: string[], parameters: any) {
  const { teamId, role = 'assistant_coach' } = parameters

  if (!teamId) {
    return NextResponse.json({ error: 'ID squadra mancante' }, { status: 400 })
  }

  // Verifica che la squadra esista
  const { data: team, error: teamError } = await adminClient
    .from('teams')
    .select('id')
    .eq('id', teamId)
    .single()

  if (teamError || !team) {
    return NextResponse.json({ error: 'Squadra non trovata' }, { status: 404 })
  }

  // Assegna i collaboratori alla squadra
  const assignments = coachIds.map(coachId => ({
    profile_id: coachId,
    team_id: teamId,
    role: role,
    assigned_at: new Date().toISOString()
  }))

  const { data, error } = await adminClient
    .from('team_members')
    .upsert(assignments, { onConflict: 'profile_id,team_id' })

  if (error) {
    console.error('Errore assegnazione collaboratori:', error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({
    message: `${coachIds.length} collaboratori assegnati alla squadra`,
    affected: coachIds.length
  })
}

async function handleTeamRemoval(adminClient: any, coachIds: string[], parameters: any) {
  const { teamId } = parameters

  if (!teamId) {
    return NextResponse.json({ error: 'ID squadra mancante' }, { status: 400 })
  }

  // Rimuovi i collaboratori dalla squadra
  const { error } = await adminClient
    .from('team_members')
    .delete()
    .in('profile_id', coachIds)
    .eq('team_id', teamId)

  if (error) {
    console.error('Errore rimozione collaboratori:', error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({
    message: `${coachIds.length} collaboratori rimossi dalla squadra`,
    affected: coachIds.length
  })
}

async function handleRoleUpdate(adminClient: any, coachIds: string[], parameters: any) {
  const { role } = parameters

  if (!role || !['head_coach', 'assistant_coach'].includes(role)) {
    return NextResponse.json({ error: 'Ruolo non valido' }, { status: 400 })
  }

  // Aggiorna il ruolo dei collaboratori nelle loro squadre
  const { error } = await adminClient
    .from('team_members')
    .update({ role: role })
    .in('profile_id', coachIds)

  if (error) {
    console.error('Errore aggiornamento ruolo:', error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({
    message: `${coachIds.length} collaboratori aggiornati con ruolo ${role}`,
    affected: coachIds.length
  })
}