import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Role = 'admin' | 'coach' | 'athlete'

const DEFAULT_TEMP_PASSWORD = 'csroma2025!'

function normalizeTeamAssignments(teamIds?: unknown): string[] {
  if (!Array.isArray(teamIds)) return []
  return teamIds
    .map((value) => (typeof value === 'string' && value.trim().length ? value.trim() : null))
    .filter((value): value is string => Boolean(value))
}

const normalizeString = (value: unknown) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    const body = await request.json()

    const {
      email,
      first_name,
      last_name,
      role,
      phone,
      birth_date,
      team_ids,
      team_assignments,
      athlete_profile: rawAthleteProfile,
      coach_profile: rawCoachProfile,
      membership_number,
      medical_certificate_expiry,
      personal_notes,
      coach_level,
      coach_specialization,
      coach_started_on
    } = body as Record<string, any>

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const requesterRole = (user as any)?.user_metadata?.role
    if (requesterRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const targetRole: Role = role
    let userId: string | null = null
    let wasCreated = false

    const athleteProfilePayload = rawAthleteProfile ?? {
      membership_number: normalizeString(membership_number),
      medical_certificate_expiry: normalizeString(medical_certificate_expiry),
      personal_notes: normalizeString(personal_notes)
    }

    const coachProfilePayload = rawCoachProfile ?? {
      level: normalizeString(coach_level),
      specialization: normalizeString(coach_specialization),
      started_on: normalizeString(coach_started_on)
    }

    const { data: existingUser } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existingUser) {
      userId = existingUser.id
    } else {
      wasCreated = true
      const { data: authCreate, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: DEFAULT_TEMP_PASSWORD,
        email_confirm: true,
        user_metadata: {
          first_name,
          last_name,
          role: targetRole,
          must_change_password: true,
          temp_password_set_at: new Date().toISOString(),
          temp_password_expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString()
        }
      })

      if (createError || !authCreate.user) {
        console.error('Errore creazione utente Supabase:', createError)

        if (createError?.message?.includes('JWT')) {
          return NextResponse.json({ error: 'Errore di autorizzazione. Verifica la Service Role Key di Supabase.' }, { status: 403 })
        }

        if (createError?.status === 422 && createError?.code === 'email_exists') {
          return NextResponse.json({ error: 'Email già registrata nel sistema. Contatta il supporto per risolvere.' }, { status: 400 })
        }

        return NextResponse.json({ error: createError?.message || 'Errore creazione utente' }, { status: 400 })
      }

      userId = authCreate.user.id

      const { error: profileError } = await adminClient
        .from('profiles')
        .upsert({
          id: userId,
          email,
          first_name,
          last_name,
          role: targetRole,
          phone: phone || null,
          birth_date: birth_date || null,
          must_change_password: true
        })

      if (profileError) {
        console.error('Errore creazione profilo:', profileError)
        return NextResponse.json({ error: 'Errore creazione profilo' }, { status: 400 })
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Impossibile determinare l’utente' }, { status: 400 })
    }

    if (existingUser) {
      // Aggiorna il ruolo usando la funzione sicura che evita loop infinito
      const { error: updateRoleError } = await adminClient
        .rpc('update_user_role_safe', {
          p_profile_id: userId,
          p_role: targetRole
        })

      if (updateRoleError) {
        console.error('Errore aggiornamento ruolo:', updateRoleError)
        return NextResponse.json({ error: 'Errore aggiornamento ruolo' }, { status: 400 })
      }

      // Aggiorna gli altri campi del profilo (tranne il ruolo che è già stato aggiornato)
      const { error: updateProfileError } = await adminClient
        .from('profiles')
        .update({
          first_name,
          last_name,
          phone: phone || null,
          birth_date: birth_date || null
        })
        .eq('id', userId)

      if (updateProfileError) {
        console.error('Errore aggiornamento profilo:', updateProfileError)
        return NextResponse.json({ error: 'Errore aggiornamento profilo' }, { status: 400 })
      }
    }

    if (targetRole === 'athlete') {
      const { error: upsertAthlete } = await adminClient
        .from('athlete_profiles')
        .upsert({
          profile_id: userId,
          membership_number: normalizeString(athleteProfilePayload?.membership_number) ?? null,
          medical_certificate_expiry: normalizeString(athleteProfilePayload?.medical_certificate_expiry) ?? null,
          personal_notes: normalizeString(athleteProfilePayload?.personal_notes) ?? null
        })

      if (upsertAthlete) {
        console.error('Errore salvataggio athlete_profiles:', upsertAthlete)
        return NextResponse.json({ error: 'Errore salvataggio dati atleta' }, { status: 400 })
      }

      await adminClient.from('coach_profiles').delete().eq('profile_id', userId)
    } else if (targetRole === 'coach') {
      const { error: upsertCoach } = await adminClient
        .from('coach_profiles')
        .upsert({
          profile_id: userId,
          level: normalizeString(coachProfilePayload?.level) ?? null,
          specialization: normalizeString(coachProfilePayload?.specialization) ?? null,
          started_on: normalizeString(coachProfilePayload?.started_on) ?? null
        })

      if (upsertCoach) {
        console.error('Errore salvataggio coach_profiles:', upsertCoach)
        return NextResponse.json({ error: 'Errore salvataggio dati coach' }, { status: 400 })
      }

      await adminClient.from('athlete_profiles').delete().eq('profile_id', userId)
    } else {
      await Promise.all([
        adminClient.from('athlete_profiles').delete().eq('profile_id', userId),
        adminClient.from('coach_profiles').delete().eq('profile_id', userId)
      ])
    }

    const normalizedTeamIds = normalizeTeamAssignments(team_ids)

    if (targetRole === 'coach') {
      await adminClient.from('team_coaches').delete().eq('coach_id', userId)

      if (normalizedTeamIds.length > 0) {
        const assignedAt = new Date().toISOString().slice(0, 10)
        const insertRows = normalizedTeamIds.map((teamId) => ({
          team_id: teamId,
          coach_id: userId,
          role: 'head_coach',
          assigned_at: assignedAt
        }))

        const { error: insertCoachTeams } = await adminClient
          .from('team_coaches')
          .insert(insertRows)

        if (insertCoachTeams) {
          console.error('Errore assegnazione team_coaches:', insertCoachTeams)
          return NextResponse.json({ error: 'Errore assegnazione squadre al coach' }, { status: 400 })
        }
      }

      await adminClient.from('team_members').delete().eq('profile_id', userId)
    }

    if (targetRole === 'athlete') {
      await adminClient.from('team_members').delete().eq('profile_id', userId)

      const assignmentsArray = Array.isArray(team_assignments) ? team_assignments : []
      const membershipRows = (assignmentsArray.length > 0 ? assignmentsArray : normalizedTeamIds.map((teamId) => ({ team_id: teamId })))
        .filter((row: any) => row && row.team_id)
        .map((row: any) => ({
          team_id: row.team_id,
          profile_id: userId,
          jersey_number: row.jersey_number ?? null
        }))

      if (membershipRows.length > 0) {
        const { error: insertMembers } = await adminClient
          .from('team_members')
          .insert(membershipRows)

        if (insertMembers) {
          console.error('Errore inserimento team_members:', insertMembers)
          return NextResponse.json({ error: 'Errore assegnazione squadre all’atleta' }, { status: 400 })
        }
      }
      await adminClient.from('team_coaches').delete().eq('coach_id', userId)
    }

    if (targetRole === 'admin') {
      await adminClient.from('team_members').delete().eq('profile_id', userId)
      await adminClient.from('team_coaches').delete().eq('coach_id', userId)
    }

    return NextResponse.json({
      success: true,
      user_id: userId,
      message: wasCreated ? 'Utente creato con successo. Password iniziale impostata.' : 'Utente aggiornato con successo'
    })
  } catch (error) {
    console.error('Errore API creazione/aggiornamento utente:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

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

    // Carica dati base profili con informazioni auth
    const { data: users, error } = await adminClient
      .from('profiles')
      .select(`
        id,
        email,
        first_name,
        last_name,
        role,
        phone,
        birth_date,
        is_active,
        created_at,
        updated_at,
        must_change_password
      `)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ users: [] })
    }

    // Carica ultimi accessi da auth.users
    const userIds = users.map(u => u.id)
    const { data: authUsers } = await adminClient.auth.admin.listUsers()

    // Mappa per accesso rapido agli utenti auth
    const authUsersMap = new Map()
    authUsers?.users?.forEach(authUser => {
      authUsersMap.set(authUser.id, authUser)
    })

    // Carica ruoli multipli da user_roles
    const { data: userRoles } = await adminClient
      .from('user_roles')
      .select('profile_id, role')
      .in('profile_id', userIds)

    // Raggruppa ruoli per utente
    const rolesByUser = new Map()
    userRoles?.forEach(ur => {
      if (!rolesByUser.has(ur.profile_id)) {
        rolesByUser.set(ur.profile_id, [])
      }
      rolesByUser.get(ur.profile_id).push(ur.role)
    })

    // Combina i dati
    const usersWithDetails = users.map(user => {
      const authUser = authUsersMap.get(user.id)
      const userRoles = rolesByUser.get(user.id) || [user.role]

      return {
        ...user,
        last_sign_in_at: authUser?.last_sign_in_at || null,
        roles: userRoles,
        is_active: user.is_active ?? true
      }
    })

    return NextResponse.json({ users: usersWithDetails })
  } catch (error) {
    console.error('Errore API lista utenti:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

// API per attivare/disattivare account
export async function PATCH(request: NextRequest) {
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
    const { userId, action, roles } = body

    if (!userId || !action) {
      return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
    }

    switch (action) {
      case 'toggle_active':
        // Toggle stato attivo/disattivo
        const { data: currentUser } = await adminClient
          .from('profiles')
          .select('is_active')
          .eq('id', userId)
          .single()

        if (!currentUser) {
          return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 })
        }

        const { error: toggleError } = await adminClient
          .from('profiles')
          .update({ is_active: !currentUser.is_active })
          .eq('id', userId)

        if (toggleError) {
          return NextResponse.json({ error: toggleError.message }, { status: 400 })
        }

        return NextResponse.json({
          success: true,
          message: `Account ${!currentUser.is_active ? 'attivato' : 'disattivato'} con successo`,
          is_active: !currentUser.is_active
        })

      case 'update_roles':
        // Aggiorna ruoli multipli
        if (!Array.isArray(roles)) {
          return NextResponse.json({ error: 'Ruoli non validi' }, { status: 400 })
        }

        // Elimina ruoli esistenti
        await adminClient.from('user_roles').delete().eq('profile_id', userId)

        // Inserisci nuovi ruoli
        if (roles.length > 0) {
          const roleRows = roles.map(role => ({
            profile_id: userId,
            role: role
          }))

          const { error: rolesError } = await adminClient
            .from('user_roles')
            .insert(roleRows)

          if (rolesError) {
            return NextResponse.json({ error: rolesError.message }, { status: 400 })
          }
        }

        // Aggiorna ruolo principale
        const primaryRole = roles.length > 0 ? roles[0] : 'athlete'
        const { error: updateRoleError } = await adminClient
          .rpc('update_user_role_safe', {
            p_profile_id: userId,
            p_role: primaryRole
          })

        if (updateRoleError) {
          return NextResponse.json({ error: updateRoleError.message }, { status: 400 })
        }

        return NextResponse.json({
          success: true,
          message: 'Ruoli aggiornati con successo',
          roles: roles
        })

      default:
        return NextResponse.json({ error: 'Azione non supportata' }, { status: 400 })
    }
  } catch (error) {
    console.error('Errore API gestione account:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('id')

    if (!userId) {
      return NextResponse.json({ error: 'Missing user id' }, { status: 400 })
    }

    await adminClient.from('team_members').delete().eq('profile_id', userId)
    await adminClient.from('team_coaches').delete().eq('coach_id', userId)
    await adminClient.from('athlete_profiles').delete().eq('profile_id', userId)
    await adminClient.from('coach_profiles').delete().eq('profile_id', userId)

    const { error: deleteProfileError } = await adminClient
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (deleteProfileError) {
      console.error('Errore eliminazione profilo:', deleteProfileError)
      return NextResponse.json({ error: deleteProfileError.message }, { status: 400 })
    }

    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId)
    if (deleteAuthError) {
      console.error('Errore eliminazione utente auth:', deleteAuthError)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Errore API eliminazione utente:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
