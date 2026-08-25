import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { collaboratorCreateSchema, collaboratorUpdateSchema } from '@/lib/validation/profiles'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'

type CollaboratorType = 'coach' | 'staff' | 'admin'

function isCollaborator(types: Set<string>, accountRoles: string[], hasCoachProfile: boolean) {
  return types.has('coach') || types.has('staff') || types.has('admin') || accountRoles.includes('coach') || accountRoles.includes('admin') || hasCoachProfile
}

async function seasonTeamIds(adminClient: ReturnType<typeof createAdminClient>, seasonId: string) {
  const { data: activities } = await adminClient.from('activities').select('id').eq('season_id', seasonId)
  const activityIds = (activities || []).map((activity) => activity.id)
  if (!activityIds.length) return []
  const { data: teams } = await adminClient.from('teams').select('id').in('activity_id', activityIds)
  return (teams || []).map((team) => team.id)
}

async function validateTeams(adminClient: ReturnType<typeof createAdminClient>, seasonId: string, type: CollaboratorType, teamIds: string[]) {
  if (!teamIds.length) return
  if (type !== 'coach') throw new Error('Staff e Admin non possono essere assegnati a una squadra')
  const { data: teams } = await adminClient.from('teams').select('id, activity_id').in('id', teamIds)
  if (!teams || teams.length !== new Set(teamIds).size) throw new Error('Una o più squadre non sono state trovate')
  const activityIds = teams.map((team) => team.activity_id)
  const { data: activities } = await adminClient.from('activities').select('id, season_id').in('id', activityIds)
  if (!activities || activities.some((activity) => activity.season_id !== seasonId)) throw new Error('Una o più squadre non appartengono alla stagione selezionata')
}

export async function GET() {
  try {
    const supabase = await createClient()
    await requireGlobalRole(supabase, 'admin')
    const adminClient = createAdminClient()
    const [{ data: profiles, error: profilesError }, { data: coachProfiles, error: coachError }, { data: seasonProfiles, error: seasonError }, { data: teamCoaches }, { data: teams }, { data: accounts }, { data: roles }] = await Promise.all([
      adminClient.from('profiles').select('id, email, first_name, last_name, phone, birth_date, created_at, updated_at').order('created_at', { ascending: false }),
      adminClient.from('coach_profiles').select('profile_id, level, specialization, started_on'),
      adminClient.from('season_profiles').select('profile_id, season_id, profile_type'),
      adminClient.from('team_coaches').select('coach_id, team_id, role, assigned_at'),
      adminClient.from('teams').select('id, name, code, activity_id'),
      adminClient.from('app_accounts').select('auth_user_id, owner_profile_id, status'),
      adminClient.from('account_roles').select('auth_user_id, role'),
    ])
    if (profilesError || coachError || seasonError) return NextResponse.json({ error: 'Impossibile caricare i collaboratori' }, { status: 500 })

    const coachById = new Map((coachProfiles || []).map((profile) => [profile.profile_id, profile]))
    const seasonsByProfile = new Map<string, string[]>()
    const typesByProfile = new Map<string, Set<string>>()
    for (const row of seasonProfiles || []) {
      seasonsByProfile.set(row.profile_id, [...(seasonsByProfile.get(row.profile_id) || []), row.season_id])
      if (row.profile_type) typesByProfile.set(row.profile_id, new Set([...(typesByProfile.get(row.profile_id) || []), row.profile_type]))
    }
    const accountByProfile = new Map((accounts || []).map((account) => [account.owner_profile_id, account]))
    const rolesByAuth = new Map<string, string[]>()
    for (const role of roles || []) rolesByAuth.set(role.auth_user_id, [...(rolesByAuth.get(role.auth_user_id) || []), role.role])
    const accountRolesByProfile = new Map<string, string[]>()
    for (const account of accounts || []) accountRolesByProfile.set(account.owner_profile_id, rolesByAuth.get(account.auth_user_id) || [])
    const teamById = new Map((teams || []).map((team) => [team.id, team]))

    const collaborators = (profiles || []).filter((profile) => {
      const account = accountByProfile.get(profile.id)
      const accountRoles = accountRolesByProfile.get(profile.id) || []
      const types = typesByProfile.get(profile.id) || new Set<string>()
      const isActive = account?.status !== 'suspended' && account?.status !== 'disabled'
      return isActive && isCollaborator(types, accountRoles, coachById.has(profile.id))
    }).map((profile) => {
      const coach = coachById.get(profile.id)
      const account = accountByProfile.get(profile.id)
      const assignments = (teamCoaches || []).filter((assignment) => assignment.coach_id === profile.id).map((assignment) => ({
        id: assignment.team_id,
        name: teamById.get(assignment.team_id)?.name || 'Squadra sconosciuta',
        role: assignment.role,
        assigned_at: assignment.assigned_at,
        activity_id: teamById.get(assignment.team_id)?.activity_id,
      }))
      const types = typesByProfile.get(profile.id) || new Set<string>()
      const accountRoles = accountRolesByProfile.get(profile.id) || []
      const type: CollaboratorType = types.has('admin') || accountRoles.includes('admin')
        ? 'admin'
        : types.has('staff') && !types.has('coach') && !coachById.has(profile.id) && !accountRoles.includes('coach')
          ? 'staff'
          : 'coach'
      return {
        ...profile,
        is_active: account?.status !== 'suspended' && account?.status !== 'disabled',
        collaborator_type: type,
        season_ids: seasonsByProfile.get(profile.id) || [],
        level: coach?.level || null,
        specialization: coach?.specialization || null,
        started_on: coach?.started_on || null,
        teams: assignments,
        account: account ? { auth_user_id: account.auth_user_id, status: account.status, roles: rolesByAuth.get(account.auth_user_id) || [] } : null,
      }
    })
    return NextResponse.json({ collaborators })
  } catch (error) {
    if (error instanceof AccountContextError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Errore API lista collaboratori:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    await requireGlobalRole(supabase, 'admin')
    const parsed = collaboratorCreateSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Dati collaboratore non validi' }, { status: 400 })
    const payload = parsed.data
    const adminClient = createAdminClient()
    const { data: season } = await adminClient.from('seasons').select('id').eq('id', payload.season_id).maybeSingle()
    if (!season) return NextResponse.json({ error: 'Stagione non trovata' }, { status: 404 })
    try { await validateTeams(adminClient, payload.season_id, payload.collaborator_type, payload.team_ids) } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Squadre non valide' }, { status: 400 }) }

    const { data: profile, error: profileError } = await adminClient.from('profiles').insert({
      first_name: payload.first_name,
      last_name: payload.last_name,
      email: payload.email ?? null,
      phone: payload.phone ?? null,
      birth_date: payload.birth_date ?? null,
      role: payload.collaborator_type === 'coach' || payload.collaborator_type === 'admin' ? payload.collaborator_type : null,
    }).select('id').single()
    if (profileError || !profile) return NextResponse.json({ error: 'Impossibile creare il collaboratore' }, { status: 400 })

    const cleanup = async () => { await adminClient.from('profiles').delete().eq('id', profile.id) }
    if (payload.collaborator_type === 'coach') {
      const { error } = await adminClient.from('coach_profiles').insert({ profile_id: profile.id, level: payload.level ?? null, specialization: payload.specialization ?? null, started_on: payload.started_on ?? null })
      if (error) { await cleanup(); return NextResponse.json({ error: 'Impossibile creare il profilo coach' }, { status: 400 }) }
    }
    const { error: seasonError } = await adminClient.from('season_profiles').insert({ profile_id: profile.id, season_id: payload.season_id, profile_type: payload.collaborator_type, source: 'admin_collaborator_create' })
    if (seasonError) { await cleanup(); return NextResponse.json({ error: 'Impossibile collegare il collaboratore alla stagione' }, { status: 400 }) }
    if (payload.team_ids.length) {
      const { error } = await adminClient.from('team_coaches').insert(payload.team_ids.map((teamId) => ({ coach_id: profile.id, team_id: teamId, role: payload.team_roles[teamId] || 'head_coach' })))
      if (error) { await cleanup(); return NextResponse.json({ error: 'Impossibile assegnare la squadra' }, { status: 400 }) }
    }
    return NextResponse.json({ profile_id: profile.id, season_id: payload.season_id, collaborator_type: payload.collaborator_type }, { status: 201 })
  } catch (error) {
    if (error instanceof AccountContextError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Errore API creazione collaboratore:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    await requireGlobalRole(supabase, 'admin')
    const parsed = collaboratorUpdateSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Dati collaboratore non validi' }, { status: 400 })
    const payload = parsed.data
    const adminClient = createAdminClient()
    const [{ data: profile }, { data: coachProfile }, { data: seasonProfile }, { data: account }] = await Promise.all([
      adminClient.from('profiles').select('id').eq('id', payload.id).maybeSingle(),
      adminClient.from('coach_profiles').select('profile_id').eq('profile_id', payload.id).maybeSingle(),
      adminClient.from('season_profiles').select('profile_type').eq('profile_id', payload.id).eq('season_id', payload.season_id).maybeSingle(),
      adminClient.from('app_accounts').select('auth_user_id').eq('owner_profile_id', payload.id).maybeSingle(),
    ])
    if (!profile) return NextResponse.json({ error: 'Collaboratore non trovato' }, { status: 404 })
    let accountRole: string | null = null
    if (account?.auth_user_id) {
      const { data: roleRow } = await adminClient.from('account_roles').select('role').eq('auth_user_id', account.auth_user_id).in('role', ['admin', 'coach', 'staff']).limit(1).maybeSingle()
      accountRole = roleRow?.role || null
    }
    const type: CollaboratorType = payload.collaborator_type
      || (seasonProfile?.profile_type as CollaboratorType | undefined)
      || (accountRole as CollaboratorType | undefined)
      || (coachProfile ? 'coach' : 'staff')
    const teamIdsPayload = payload.team_ids || []
    const teamRolesPayload = payload.team_roles || {}
    try { await validateTeams(adminClient, payload.season_id, type, teamIdsPayload) } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Squadre non valide' }, { status: 400 }) }

    const profileUpdate: Record<string, string | null> = {}
    for (const field of ['first_name', 'last_name', 'email', 'phone', 'birth_date'] as const) if (field in payload) profileUpdate[field] = payload[field] ?? null
    if (Object.keys(profileUpdate).length) {
      const { error } = await adminClient.from('profiles').update(profileUpdate).eq('id', payload.id)
      if (error) return NextResponse.json({ error: 'Impossibile aggiornare l’anagrafica' }, { status: 400 })
    }
    if (type === 'coach') {
      const coachUpdate: Record<string, string | null> = {}
      for (const field of ['level', 'specialization', 'started_on'] as const) if (field in payload) coachUpdate[field] = payload[field] ?? null
      const { data: existingCoach } = await adminClient.from('coach_profiles').select('profile_id').eq('profile_id', payload.id).maybeSingle()
      if (existingCoach) { if (Object.keys(coachUpdate).length) await adminClient.from('coach_profiles').update(coachUpdate).eq('profile_id', payload.id) }
      else await adminClient.from('coach_profiles').insert({ profile_id: payload.id, ...coachUpdate })
    } else {
      await adminClient.from('team_coaches').delete().eq('coach_id', payload.id)
      await adminClient.from('coach_profiles').delete().eq('profile_id', payload.id)
    }
    const { error: seasonError } = await adminClient.from('season_profiles').upsert({ profile_id: payload.id, season_id: payload.season_id, profile_type: type, source: 'admin_collaborator_update' }, { onConflict: 'profile_id,season_id' })
    if (seasonError) return NextResponse.json({ error: 'Impossibile aggiornare la stagione' }, { status: 400 })
    const teamIds = await seasonTeamIds(adminClient, payload.season_id)
    if (teamIds.length) await adminClient.from('team_coaches').delete().eq('coach_id', payload.id).in('team_id', teamIds)
    if (teamIdsPayload.length) await adminClient.from('team_coaches').insert(teamIdsPayload.map((teamId) => ({ coach_id: payload.id, team_id: teamId, role: teamRolesPayload[teamId] || 'head_coach' })))
    return NextResponse.json({ success: true, profile_id: payload.id, season_id: payload.season_id })
  } catch (error) {
    if (error instanceof AccountContextError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Errore API modifica collaboratore:', error)
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
    if (!id || !seasonId) return NextResponse.json({ error: 'Collaboratore e stagione sono obbligatori' }, { status: 400 })
    const adminClient = createAdminClient()
    const { data: membership } = await adminClient.from('season_profiles').select('profile_id').eq('profile_id', id).eq('season_id', seasonId).maybeSingle()
    if (!membership) return NextResponse.json({ error: 'Collaboratore non presente nella stagione selezionata' }, { status: 404 })
    const teamIds = await seasonTeamIds(adminClient, seasonId)
    if (teamIds.length) await adminClient.from('team_coaches').delete().eq('coach_id', id).in('team_id', teamIds)
    const { error } = await adminClient.from('season_profiles').delete().eq('profile_id', id).eq('season_id', seasonId)
    if (error) return NextResponse.json({ error: 'Impossibile rimuovere il collegamento stagionale' }, { status: 400 })
    const { count } = await adminClient.from('season_profiles').select('profile_id', { count: 'exact', head: true }).eq('profile_id', id)
    if (!count) await adminClient.from('profiles').update({ is_active: false }).eq('id', id)
    return NextResponse.json({ success: true, profile_id: id, season_id: seasonId, archived: !count })
  } catch (error) {
    if (error instanceof AccountContextError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Errore API rimozione collaboratore:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
