import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { userPatchPayloadSchema, userPayloadSchema } from '@/lib/validation/users'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'

type Role = 'admin' | 'coach' | 'athlete'

function getAuthCallbackUrl(request: NextRequest): string {
  return new URL('/auth/callback', request.url).toString()
}

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
  return NextResponse.json({
    error: 'La creazione degli account avviene dalla sezione Iscritti o Collaboratori.'
  }, { status: 410 })
}

/* Legacy path retained temporarily for migration history; no longer callable.
  try {
    const supabase = await createClient()
    const parsed = userPayloadSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dati utente non validi' }, { status: 400 })
    }

    const {
      email, first_name, last_name, role, phone, birth_date, team_ids,
      team_assignments, athlete_profile: rawAthleteProfile, coach_profile: rawCoachProfile,
      membership_number, medical_certificate_expiry, personal_notes,
      coach_level, coach_specialization, coach_started_on
    } = parsed.data

    await requireGlobalRole(supabase, 'admin')
    const adminClient = createAdminClient()

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
      const { data: authCreate, error: createError } = await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: getAuthCallbackUrl(request),
        data: { first_name, last_name }
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

      const { error: metadataError } = await adminClient.auth.admin.updateUserById(userId, {
        app_metadata: { role: targetRole, must_change_password: true }
      })
      if (metadataError) {
        console.error('Errore aggiornamento metadati auth:', metadataError)
        return NextResponse.json({ error: 'Errore configurazione invito utente' }, { status: 400 })
      }

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
      message: wasCreated ? 'Utente creato. È stato inviato un link per impostare la password.' : 'Utente aggiornato con successo'
    })
  } catch (error) {
    console.error('Errore API creazione/aggiornamento utente:', error)
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
} */

export async function GET() {
  try {
    const supabase = await createClient()
    await requireGlobalRole(supabase, 'admin')
    const adminClient = createAdminClient()

    // La sezione Utenti mostra solo account applicativi già provisionati.
    const { data: users, error } = await adminClient
      .from('profiles')
      .select(`
        id,
        email,
        first_name,
        last_name,
        phone,
        birth_date,
        created_at,
        updated_at,
        must_change_password,
        app_accounts!inner(auth_user_id,status,must_change_password,owner_profile_id)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ users: [] })
    }

    // Carica ultimi accessi da auth.users e ruoli dal modello account.
    const { data: authUsers } = await adminClient.auth.admin.listUsers()

    // Mappa per accesso rapido agli utenti auth
    const authUsersMap = new Map()
    authUsers?.users?.forEach(authUser => {
      authUsersMap.set(authUser.id, authUser)
    })

    const accounts = users
      .map(user => ({ user, account: Array.isArray(user.app_accounts) ? user.app_accounts[0] : user.app_accounts }))
      .filter(({ account }) => Boolean(account?.auth_user_id))

    if (accounts.length === 0) return NextResponse.json({ users: [] })

    const authUserIds = accounts.map(({ account }) => account.auth_user_id)
    const { data: userRoles } = await adminClient
      .from('account_roles')
      .select('auth_user_id, role')
      .in('auth_user_id', authUserIds)

    // Raggruppa ruoli per utente
    const rolesByUser = new Map<string, string[]>()
    userRoles?.forEach(ur => {
      if (!rolesByUser.has(ur.auth_user_id)) {
        rolesByUser.set(ur.auth_user_id, [])
      }
      rolesByUser.get(ur.auth_user_id)?.push(ur.role)
    })

    // Combina i dati
    const usersWithDetails = accounts.map(({ user, account }) => {
      const authUser = authUsersMap.get(account.auth_user_id)
      const rawRoles: unknown[] = rolesByUser.get(account.auth_user_id) || []
      const userRoles = rawRoles.filter(
        (role: unknown): role is string => typeof role === 'string' && role.length > 0
      )

      return {
        ...user,
        account_status: account.status,
        account_must_change_password: account.must_change_password,
        last_sign_in_at: authUser?.last_sign_in_at || null,
        roles: userRoles,
        is_active: account.status === 'active'
      }
    })

    return NextResponse.json({ users: usersWithDetails })
  } catch (error) {
    console.error('Errore API lista utenti:', error)
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

// API per attivare/disattivare account
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    await requireGlobalRole(supabase, 'admin')
    const adminClient = createAdminClient()

    const parsed = userPatchPayloadSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Parametri non validi' }, { status: 400 })
    }
    const { userId, action } = parsed.data

    switch (action) {
      case 'toggle_active':
        const { data: currentAccount } = await adminClient
          .from('app_accounts')
          .select('status')
          .eq('owner_profile_id', userId)
          .maybeSingle()

        if (!currentAccount) {
          return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 })
        }

        const nextStatus = currentAccount.status === 'active' ? 'disabled' : 'active'
        const { error: toggleError } = await adminClient
          .from('app_accounts')
          .update({
            status: nextStatus,
            disabled_at: nextStatus === 'disabled' ? new Date().toISOString() : null
          })
          .eq('owner_profile_id', userId)

        if (toggleError) {
          return NextResponse.json({ error: toggleError.message }, { status: 400 })
        }

        return NextResponse.json({
          success: true,
          message: `Account ${nextStatus === 'active' ? 'attivato' : 'disattivato'} con successo`,
          is_active: nextStatus === 'active',
          account_status: nextStatus
        })

      case 'update_roles':
        return NextResponse.json({
          error: 'I ruoli vengono gestiti nelle sezioni Iscritti e Collaboratori.'
        }, { status: 410 })

      default:
        return NextResponse.json({ error: 'Azione non supportata' }, { status: 400 })
    }
  } catch (error) {
    console.error('Errore API gestione account:', error)
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    await requireGlobalRole(supabase, 'admin')
    const adminClient = createAdminClient()

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('id')

    if (!userId) {
      return NextResponse.json({ error: 'Missing user id' }, { status: 400 })
    }

    const { error: disableError } = await adminClient
      .from('app_accounts')
      .update({ status: 'disabled', disabled_at: new Date().toISOString() })
      .eq('owner_profile_id', userId)

    if (disableError) {
      console.error('Errore disattivazione account:', disableError)
      return NextResponse.json({ error: disableError.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Account disattivato. Profilo, Auth, sessioni e storico sono stati conservati.'
    })
  } catch (error) {
    console.error('Errore API eliminazione utente:', error)
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
