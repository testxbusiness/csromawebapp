import { NextRequest, NextResponse } from 'next/server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { profileCreateSchema } from '@/lib/validation/profiles'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'
import { getAccountActorSnapshot, recordAccountLifecycleAudit } from '@/server/audit/account-lifecycle'

type ProfileRow = {
  id: string
  email: string | null
  first_name: string
  last_name: string
  phone: string | null
  birth_date: string | null
  role: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

type AccountRow = {
  auth_user_id: string
  owner_profile_id: string
  status: string
  must_change_password: boolean
  invited_at: string | null
  activated_at: string | null
  suspended_at: string | null
  disabled_at: string | null
}

type RelationshipRow = {
  id: string
  source_profile_id: string
  target_profile_id: string
  relationship_type: string
  status: string
  can_view_schedule: boolean
  can_confirm_attendance: boolean
  can_view_payments: boolean
  can_view_medical_status: boolean
  can_view_documents: boolean
  can_sign_documents: boolean
  can_receive_messages: boolean
  verified_at: string | null
}

export async function GET() {
  try {
    const supabase = await createClient()
    await requireGlobalRole(supabase, 'admin')
    const adminClient = createAdminClient()

    const [{ data: profiles, error: profilesError }, { data: accounts, error: accountsError }, { data: roles, error: rolesError }, { data: relationships, error: relationshipsError }, { data: collaboratorProfiles, error: collaboratorProfilesError }] = await Promise.all([
      adminClient
        .from('profiles')
        .select('id, email, first_name, last_name, phone, birth_date, role, is_active, created_at, updated_at')
        .order('created_at', { ascending: false }),
      adminClient
        .from('app_accounts')
        .select('auth_user_id, owner_profile_id, status, must_change_password, invited_at, activated_at, suspended_at, disabled_at'),
      adminClient
        .from('account_roles')
        .select('auth_user_id, role'),
      adminClient
        .from('profile_relationships')
        .select('id, source_profile_id, target_profile_id, relationship_type, status, can_view_schedule, can_confirm_attendance, can_view_payments, can_view_medical_status, can_view_documents, can_sign_documents, can_receive_messages, verified_at')
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
      adminClient
        .from('season_profiles')
        .select('profile_id, profile_type')
        .in('profile_type', ['coach', 'staff', 'admin']),
    ])

    if (profilesError || accountsError || rolesError || relationshipsError || collaboratorProfilesError) {
      console.error('Errore caricamento persone:', profilesError || accountsError || rolesError || relationshipsError || collaboratorProfilesError)
      return NextResponse.json({ error: 'Impossibile caricare le persone' }, { status: 500 })
    }

    const accountsByProfile = new Map((accounts as AccountRow[] ?? []).map((account) => [account.owner_profile_id, account]))
    const rolesByAuthUser = new Map<string, string[]>()

    for (const row of roles ?? []) {
      const current = rolesByAuthUser.get(row.auth_user_id) ?? []
      current.push(row.role)
      rolesByAuthUser.set(row.auth_user_id, current)
    }

    const collaboratorProfileIds = new Set((collaboratorProfiles ?? []).map((row) => row.profile_id))
    const profilesById = new Map((profiles as ProfileRow[] ?? []).map((profile) => [profile.id, profile]))
    const relationshipsByProfile = new Map<string, Array<{
      id: string
      person_id: string
      person_name: string
      relationship_type: string
      status: string
      verified_at: string | null
      permissions: string[]
    }>>()

    for (const relationship of relationships as RelationshipRow[] ?? []) {
      const permissionLabels = [
        relationship.can_view_schedule ? 'Calendario' : null,
        relationship.can_confirm_attendance ? 'Presenze' : null,
        relationship.can_view_payments ? 'Pagamenti' : null,
        relationship.can_view_medical_status ? 'Certificato medico' : null,
        relationship.can_view_documents ? 'Documenti' : null,
        relationship.can_sign_documents ? 'Firma documenti' : null,
        relationship.can_receive_messages ? 'Messaggi' : null,
      ].filter((label): label is string => label !== null)

      for (const [profileId, otherProfileId] of [
        [relationship.source_profile_id, relationship.target_profile_id],
        [relationship.target_profile_id, relationship.source_profile_id],
      ] as const) {
        const otherProfile = profilesById.get(otherProfileId)
        const current = relationshipsByProfile.get(profileId) ?? []
        current.push({
          id: relationship.id,
          person_id: otherProfileId,
          person_name: otherProfile ? `${otherProfile.first_name} ${otherProfile.last_name}` : 'Persona non trovata',
          relationship_type: relationship.relationship_type,
          status: relationship.status,
          verified_at: relationship.verified_at,
          permissions: permissionLabels,
        })
        relationshipsByProfile.set(profileId, current)
      }
    }

    const result = (profiles as ProfileRow[] ?? []).map((profile) => {
      const account = accountsByProfile.get(profile.id)
      return {
        ...profile,
        relationships: relationshipsByProfile.get(profile.id) ?? [],
        is_collaborator: collaboratorProfileIds.has(profile.id) || ['admin', 'coach'].includes(profile.role || ''),
        account: account ? {
          auth_user_id: account.auth_user_id,
          status: account.status,
          must_change_password: account.must_change_password,
          invited_at: account.invited_at,
          activated_at: account.activated_at,
          suspended_at: account.suspended_at,
          disabled_at: account.disabled_at,
          roles: rolesByAuthUser.get(account.auth_user_id) ?? [],
        } : null,
      }
    })

    return NextResponse.json({ profiles: result })
  } catch (error) {
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Errore API lista persone:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const account = await requireGlobalRole(supabase, 'admin')
    const parsed = profileCreateSchema.safeParse(await request.json().catch(() => null))

    if (!parsed.success) {
      return NextResponse.json({ error: 'Dati persona non validi' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const payload = parsed.data
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
      console.error('Errore creazione persona:', profileError)
      return NextResponse.json({ error: 'Impossibile creare la persona' }, { status: 400 })
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
          has_email: Boolean(payload.email),
          created_without_account: true,
        },
      })
    } catch (auditError) {
      await adminClient.from('profiles').delete().eq('id', profile.id)
      console.error('Errore audit creazione persona:', auditError)
      return NextResponse.json({ error: 'Impossibile completare la creazione della persona' }, { status: 500 })
    }

    return NextResponse.json({ profile, account: null }, { status: 201 })
  } catch (error) {
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Errore API creazione persona:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
