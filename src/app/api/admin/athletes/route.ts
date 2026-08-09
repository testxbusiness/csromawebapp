import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { athleteCreateSchema, athleteUpdateSchema } from '@/lib/validation/profiles'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'
import { getAccountActorSnapshot, recordAccountLifecycleAudit } from '@/server/audit/account-lifecycle'

export async function GET() {
  try {
    const supabase = await createClient()
    await requireGlobalRole(supabase, 'admin')
    const adminClient = createAdminClient()

    // Carica atleti con dettagli base
    const [{ data: profiles, error: profilesError }, { data: athleteProfiles, error: athleteProfilesError }, { data: teamMembers, error: teamMembersError }] = await Promise.all([
      adminClient
      .from('profiles')
      .select(`
        id,
        email,
        first_name,
        last_name,
        phone,
        birth_date,
        is_active,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false }),
      adminClient
        .from('athlete_profiles')
        .select('profile_id, membership_number, medical_certificate_expiry, personal_notes'),
      adminClient
        .from('team_members')
        .select('profile_id, team_id, jersey_number'),
    ])

    if (profilesError || athleteProfilesError || teamMembersError) {
      console.error('Errore caricamento atleti:', profilesError || athleteProfilesError || teamMembersError)
      return NextResponse.json({ error: 'Impossibile caricare gli atleti' }, { status: 400 })
    }

    const athleteIds = new Set([
      ...(athleteProfiles ?? []).map((profile) => profile.profile_id),
      ...(teamMembers ?? []).map((member) => member.profile_id),
    ])
    const athletes = (profiles ?? []).filter((profile) => athleteIds.has(profile.id) && profile.is_active !== false)

    if (athletes.length === 0) {
      return NextResponse.json({ athletes: [] })
    }

    const athleteProfileIds = athletes.map((athlete) => athlete.id)

    const { data: seasonProfiles, error: seasonProfilesError } = await adminClient
      .from('season_profiles')
      .select('profile_id, season_id')
      .in('profile_id', athleteProfileIds)

    if (seasonProfilesError) {
      console.error('Errore caricamento stagioni atleti:', seasonProfilesError)
      return NextResponse.json({ error: 'Impossibile caricare le stagioni degli atleti' }, { status: 400 })
    }

    const [{ data: accounts, error: accountsError }, { data: accountRoles, error: accountRolesError }] = await Promise.all([
      adminClient
        .from('app_accounts')
        .select('auth_user_id, owner_profile_id, status')
        .in('owner_profile_id', athleteProfileIds),
      adminClient
        .from('account_roles')
        .select('auth_user_id, role'),
    ])

    if (accountsError || accountRolesError) {
      console.error('Errore caricamento account atleti:', accountsError || accountRolesError)
      return NextResponse.json({ error: 'Impossibile caricare lo stato account degli atleti' }, { status: 400 })
    }

    const rolesByAuthUser = new Map<string, string[]>()
    for (const roleRow of accountRoles ?? []) {
      const roles = rolesByAuthUser.get(roleRow.auth_user_id) ?? []
      roles.push(roleRow.role)
      rolesByAuthUser.set(roleRow.auth_user_id, roles)
    }
    const accountsByProfile = new Map((accounts ?? []).map((account) => [account.owner_profile_id, account]))

    const seasonalAthleteIds = new Set((seasonProfiles ?? []).map((seasonProfile) => seasonProfile.profile_id))
    const activeSeasonAthletes = athletes.filter((athlete) => seasonalAthleteIds.has(athlete.id))

    // Carica team memberships separatamente - recupera tutti e poi filtra
    const filteredTeamMembers = (teamMembers ?? []).filter((member) => activeSeasonAthletes.some((athlete) => athlete.id === member.profile_id))

    // Carica dettagli squadre separatamente - recupera tutte e poi filtra
    const teamIds = filteredTeamMembers.map((member) => member.team_id).filter(Boolean)

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
    const formattedAthletes = activeSeasonAthletes.map(athlete => {
      const athleteProfile = athleteProfiles?.find(ap => ap.profile_id === athlete.id)
      const athleteTeamMembers = filteredTeamMembers.filter((member) => member.profile_id === athlete.id)
      const athleteSeasonIds = (seasonProfiles ?? [])
        .filter((seasonProfile) => seasonProfile.profile_id === athlete.id)
        .map((seasonProfile) => seasonProfile.season_id)
      const account = accountsByProfile.get(athlete.id)

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
        membership_number: athleteProfile?.membership_number ?? null,
        medical_certificate_expiry: athleteProfile?.medical_certificate_expiry ?? null,
        personal_notes: athleteProfile?.personal_notes ?? null,
        created_at: athlete.created_at,
        updated_at: athlete.updated_at,
        season_ids: athleteSeasonIds,
        account: account ? {
          status: account.status,
          roles: rolesByAuthUser.get(account.auth_user_id) ?? [],
        } : null,
        teams: teamsWithDetails.filter(team => team.id)
      }

      return athleteData
    })

    return NextResponse.json({ athletes: formattedAthletes })
  } catch (error) {
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Errore API lista atleti:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const account = await requireGlobalRole(supabase, 'admin')
    const parsed = athleteCreateSchema.safeParse(await request.json().catch(() => null))

    if (!parsed.success) {
      return NextResponse.json({ error: 'Dati atleta non validi' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const payload = parsed.data
    const { data: season } = await adminClient
      .from('seasons')
      .select('id')
      .eq('id', payload.season_id)
      .maybeSingle()

    if (!season) {
      return NextResponse.json({ error: 'Stagione non trovata' }, { status: 404 })
    }

    if (payload.team_id) {
      const { data: team } = await adminClient
        .from('teams')
        .select('id, activity_id')
        .eq('id', payload.team_id)
        .maybeSingle()

      if (!team) {
        return NextResponse.json({ error: 'Squadra non trovata' }, { status: 404 })
      }

      const { data: activity } = await adminClient
        .from('activities')
        .select('id, season_id')
        .eq('id', team.activity_id)
        .maybeSingle()

      if (!activity || activity.season_id !== payload.season_id) {
        return NextResponse.json({ error: 'La squadra non appartiene alla stagione selezionata' }, { status: 400 })
      }
    }

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .insert({
        first_name: payload.first_name,
        last_name: payload.last_name,
        email: payload.email ?? null,
        phone: payload.phone ?? null,
        birth_date: payload.birth_date ?? null,
        role: null,
      })
      .select('id, email, first_name, last_name, phone, birth_date, role, is_active, created_at, updated_at')
      .single()

    if (profileError || !profile) {
      console.error('Errore creazione profilo atleta:', profileError)
      return NextResponse.json({ error: 'Impossibile creare l’atleta' }, { status: 400 })
    }

    const { error: athleteProfileError } = await adminClient
      .from('athlete_profiles')
      .insert({
        profile_id: profile.id,
        membership_number: payload.membership_number ?? null,
        medical_certificate_expiry: payload.medical_certificate_expiry ?? null,
        personal_notes: payload.personal_notes ?? null,
      })

    const { error: seasonProfileError } = athleteProfileError
      ? { error: null }
      : await adminClient
          .from('season_profiles')
          .insert({ profile_id: profile.id, season_id: payload.season_id, source: 'admin_athlete_create' })

    let teamMemberError: { message: string } | null = null
    if (!athleteProfileError && !seasonProfileError && payload.team_id) {
      const { error } = await adminClient
        .from('team_members')
        .insert({
          profile_id: profile.id,
          team_id: payload.team_id,
          role: 'athlete',
          jersey_number: payload.jersey_number ?? null,
        })
      teamMemberError = error
    }

    if (athleteProfileError || seasonProfileError || teamMemberError) {
      await adminClient.from('profiles').delete().eq('id', profile.id)
      console.error('Errore completamento creazione atleta:', athleteProfileError || seasonProfileError || teamMemberError)
      return NextResponse.json({ error: 'Impossibile completare la creazione dell’atleta' }, { status: 400 })
    }

    try {
      const actor = await getAccountActorSnapshot(adminClient, account.ownerProfileId)
      await recordAccountLifecycleAudit(adminClient, {
        eventType: 'profile_created',
        subjectProfileId: profile.id,
        performedByAuthUserId: account.authUserId,
        performedByProfileId: account.ownerProfileId,
        ...actor,
        details: {
          profile_type: 'athlete',
          season_id: payload.season_id,
          created_without_account: true,
        },
      })
    } catch (auditError) {
      await adminClient.from('profiles').delete().eq('id', profile.id)
      console.error('Errore audit creazione atleta:', auditError)
      return NextResponse.json({ error: 'Impossibile completare la creazione dell’atleta' }, { status: 500 })
    }

    return NextResponse.json({ profile, season_id: payload.season_id, team_id: payload.team_id ?? null, account: null }, { status: 201 })
  } catch (error) {
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Errore API creazione atleta:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    await requireGlobalRole(supabase, 'admin')
    const parsed = athleteUpdateSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Dati atleta non validi' }, { status: 400 })

    const adminClient = createAdminClient()
    const payload = parsed.data
    const { data: profile } = await adminClient.from('profiles').select('id').eq('id', payload.id).maybeSingle()
    const { data: season } = await adminClient.from('seasons').select('id').eq('id', payload.season_id).maybeSingle()
    const { data: athleteProfile } = await adminClient.from('athlete_profiles').select('profile_id').eq('profile_id', payload.id).maybeSingle()
    if (!profile || !athleteProfile) return NextResponse.json({ error: 'Atleta non trovato' }, { status: 404 })
    if (!season) return NextResponse.json({ error: 'Stagione non trovata' }, { status: 404 })

    let teamId = payload.team_id
    if (teamId) {
      const { data: team } = await adminClient.from('teams').select('id, activity_id').eq('id', teamId).maybeSingle()
      if (!team) return NextResponse.json({ error: 'Squadra non trovata' }, { status: 404 })
      const { data: activity } = await adminClient.from('activities').select('id, season_id').eq('id', team.activity_id).maybeSingle()
      if (!activity || activity.season_id !== payload.season_id) return NextResponse.json({ error: 'La squadra non appartiene alla stagione selezionata' }, { status: 400 })
    }

    const profileUpdate: Record<string, string | null> = {}
    for (const field of ['first_name', 'last_name', 'email', 'phone', 'birth_date'] as const) {
      if (field in payload) profileUpdate[field] = payload[field] ?? null
    }
    if (Object.keys(profileUpdate).length > 0) {
      const { error } = await adminClient.from('profiles').update(profileUpdate).eq('id', payload.id)
      if (error) return NextResponse.json({ error: 'Impossibile aggiornare l’anagrafica' }, { status: 400 })
    }

    const athleteUpdate: Record<string, string | null> = {}
    for (const field of ['membership_number', 'medical_certificate_expiry', 'personal_notes'] as const) {
      if (field in payload) athleteUpdate[field] = payload[field] ?? null
    }
    if (Object.keys(athleteUpdate).length > 0) {
      const { error } = await adminClient.from('athlete_profiles').update(athleteUpdate).eq('profile_id', payload.id)
      if (error) return NextResponse.json({ error: 'Impossibile aggiornare i dati atleta' }, { status: 400 })
    }

    const { error: seasonError } = await adminClient.from('season_profiles').upsert({
      profile_id: payload.id,
      season_id: payload.season_id,
      profile_type: 'athlete',
      source: 'admin_athlete_update',
    }, { onConflict: 'profile_id,season_id' })
    if (seasonError) return NextResponse.json({ error: 'Impossibile aggiornare il collegamento stagionale' }, { status: 400 })

    if ('team_id' in payload) {
      const { data: activities } = await adminClient.from('activities').select('id').eq('season_id', payload.season_id)
      const activityIds = (activities || []).map((activity) => activity.id)
      const { data: seasonTeams } = activityIds.length
        ? await adminClient.from('teams').select('id').in('activity_id', activityIds)
        : { data: [] }
      const seasonTeamIds = (seasonTeams || []).map((team) => team.id)
      if (seasonTeamIds.length) await adminClient.from('team_members').delete().eq('profile_id', payload.id).in('team_id', seasonTeamIds)
      if (teamId) {
        const { error } = await adminClient.from('team_members').insert({
          profile_id: payload.id,
          team_id: teamId,
          role: 'athlete',
          jersey_number: payload.jersey_number ?? null,
        })
        if (error) return NextResponse.json({ error: 'Impossibile aggiornare la squadra' }, { status: 400 })
      }
    }

    return NextResponse.json({ success: true, profile_id: payload.id, season_id: payload.season_id, team_id: teamId ?? null })
  } catch (error) {
    if (error instanceof AccountContextError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Errore API modifica atleta:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    await requireGlobalRole(supabase, 'admin')
    const body = await request.json().catch(() => null)
    const id = typeof body?.id === 'string' ? body.id : ''
    const seasonId = typeof body?.season_id === 'string' ? body.season_id : ''
    if (!id || !seasonId) return NextResponse.json({ error: 'Atleta e stagione sono obbligatori' }, { status: 400 })

    const adminClient = createAdminClient()
    const { data: membership } = await adminClient.from('season_profiles').select('profile_id').eq('profile_id', id).eq('season_id', seasonId).maybeSingle()
    if (!membership) return NextResponse.json({ error: 'L’atleta non è iscritto alla stagione selezionata' }, { status: 404 })

    const { data: activities } = await adminClient.from('activities').select('id').eq('season_id', seasonId)
    const activityIds = (activities || []).map((activity) => activity.id)
    const { data: seasonTeams } = activityIds.length
      ? await adminClient.from('teams').select('id').in('activity_id', activityIds)
      : { data: [] }
    const teamIds = (seasonTeams || []).map((team) => team.id)
    if (teamIds.length) await adminClient.from('team_members').delete().eq('profile_id', id).in('team_id', teamIds)
    const { error } = await adminClient.from('season_profiles').delete().eq('profile_id', id).eq('season_id', seasonId)
    if (error) return NextResponse.json({ error: 'Impossibile rimuovere l’iscrizione' }, { status: 400 })

    return NextResponse.json({ success: true, profile_id: id, season_id: seasonId, archived: true })
  } catch (error) {
    if (error instanceof AccountContextError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Errore API rimozione iscrizione:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
