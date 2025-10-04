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

    // Carica atleti con dettagli base
    const { data: athletes, error } = await adminClient
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
      .eq('role', 'athlete')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Errore caricamento atleti:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (!athletes || athletes.length === 0) {
      return NextResponse.json({ athletes: [] })
    }

    // Carica profili atleti separatamente
    const athleteIds = athletes.map(a => a.id)
    const { data: athleteProfiles } = await adminClient
      .from('athlete_profiles')
      .select('profile_id, membership_number, medical_certificate_expiry, personal_notes')
      .in('profile_id', athleteIds)

    // Carica team memberships separatamente - recupera tutti e poi filtra
    const { data: allTeamMembers, error: teamMembersError } = await adminClient
      .from('team_members')
      .select('profile_id, team_id, jersey_number')

    if (teamMembersError) {
      console.error('Errore caricamento team_members:', teamMembersError)
    }

    // Filtra lato JavaScript per evitare "URI too long"
    const teamMembers = allTeamMembers?.filter(tm =>
      athleteIds.includes(tm.profile_id)
    ) || []

    // Carica dettagli squadre separatamente - recupera tutte e poi filtra
    const teamIds = teamMembers?.map(tm => tm.team_id).filter(Boolean) || []

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
    const formattedAthletes = athletes.map(athlete => {
      const athleteProfile = athleteProfiles?.find(ap => ap.profile_id === athlete.id) || {}
      const athleteTeamMembers = teamMembers?.filter(tm => tm.profile_id === athlete.id) || []

      const teamsWithDetails = athleteTeamMembers.map(membership => {
        const team = teams?.find(t => t.id === membership.team_id)
        return {
          id: membership.team_id,
          name: team?.name || 'Squadra sconosciuta',
          jersey_number: membership.jersey_number,
          activity_id: team?.activity_id
        }
      })

      const athleteData = {
        id: athlete.id,
        email: athlete.email,
        first_name: athlete.first_name,
        last_name: athlete.last_name,
        phone: athlete.phone,
        birth_date: athlete.birth_date,
        membership_number: athleteProfile.membership_number,
        medical_certificate_expiry: athleteProfile.medical_certificate_expiry,
        personal_notes: athleteProfile.personal_notes,
        created_at: athlete.created_at,
        updated_at: athlete.updated_at,
        teams: teamsWithDetails.filter(team => team.id)
      }

      return athleteData
    })

    return NextResponse.json({ athletes: formattedAthletes })
  } catch (error) {
    console.error('Errore API lista atleti:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}