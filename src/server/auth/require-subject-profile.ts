import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/server'
import {
  AccountContextError,
  type AccountContext,
  requireAccountContext,
} from '@/server/auth/require-account-context'

export type SubjectPermission =
  | 'view_schedule'
  | 'confirm_attendance'
  | 'view_payments'
  | 'view_medical_status'
  | 'view_documents'
  | 'sign_documents'
  | 'receive_messages'

export type SubjectPermissions = Record<SubjectPermission, boolean>

type RelationshipPermissionRow = {
  source_profile_id: string
  target_profile_id: string
  relationship_type: string
  verified_at: string | null
  can_view_schedule: boolean
  can_confirm_attendance: boolean
  can_view_payments: boolean
  can_view_medical_status: boolean
  can_view_documents: boolean
  can_sign_documents: boolean
  can_receive_messages: boolean
}

function isMinor(birthDate: string | null, override: boolean | null | undefined) {
  if (override !== null && override !== undefined) return override
  if (!birthDate) return true
  const eighteenthBirthday = new Date(`${birthDate}T00:00:00Z`)
  eighteenthBirthday.setUTCFullYear(eighteenthBirthday.getUTCFullYear() + 18)
  return new Date() < eighteenthBirthday
}

export async function resolveSubjectProfile(
  supabase: SupabaseClient,
  account: AccountContext,
  requestedProfileId: string | null,
  permission?: SubjectPermission
) {
  if (!requestedProfileId || requestedProfileId === account.ownerProfileId) {
    return {
      profileId: account.ownerProfileId,
      dataClient: supabase,
      delegated: false,
      permissions: Object.fromEntries([
        'view_schedule', 'confirm_attendance', 'view_payments', 'view_medical_status',
        'view_documents', 'sign_documents', 'receive_messages',
      ].map((permission) => [permission, true])) as SubjectPermissions,
    }
  }

  const adminClient = createAdminClient()
  const [{ data: relationship, error: relationshipError }, { data: profile, error: profileError }, { data: override, error: overrideError }] = await Promise.all([
    adminClient
      .from('profile_relationships')
      .select('source_profile_id, target_profile_id, relationship_type, verified_at, can_view_schedule, can_confirm_attendance, can_view_payments, can_view_medical_status, can_view_documents, can_sign_documents, can_receive_messages')
      .eq('source_profile_id', account.ownerProfileId)
      .eq('target_profile_id', requestedProfileId)
      .eq('status', 'active')
      .lte('valid_from', new Date().toISOString().slice(0, 10))
      .or(`valid_until.is.null,valid_until.gte.${new Date().toISOString().slice(0, 10)}`)
      .maybeSingle(),
    adminClient.from('profiles').select('birth_date').eq('id', requestedProfileId).maybeSingle(),
    adminClient.from('profile_age_overrides').select('treat_as_minor').eq('profile_id', requestedProfileId).eq('active', true).maybeSingle(),
  ])

  if (relationshipError || profileError || overrideError) {
    throw new AccountContextError('Impossibile verificare il profilo accessibile', 500)
  }
  if (!relationship || !profile) throw new AccountContextError('Profilo accessibile non autorizzato', 403)

  const relation = relationship as RelationshipPermissionRow
  const permissions = {
    view_schedule: relation.can_view_schedule,
    confirm_attendance: relation.can_confirm_attendance,
    view_payments: relation.can_view_payments,
    view_medical_status: relation.can_view_medical_status,
    view_documents: relation.can_view_documents,
    sign_documents: relation.can_sign_documents,
    receive_messages: relation.can_receive_messages,
  }
  const permissionGranted = permission
    ? permissions[permission]
    : permissions.view_schedule || permissions.view_payments || permissions.receive_messages
  if (!permissionGranted) throw new AccountContextError('Permesso sul profilo accessibile non concesso', 403)

  const targetIsMinor = isMinor(profile.birth_date, override?.treat_as_minor)
  const adultDelegate = relation.relationship_type === 'delegate' && relation.verified_at !== null
  const minorRelationship = ['parent', 'guardian', 'caregiver', 'delegate'].includes(relation.relationship_type)
  if ((!targetIsMinor && !adultDelegate) || (targetIsMinor && !minorRelationship)) {
    throw new AccountContextError('Relazione non valida per il profilo accessibile', 403)
  }

  return {
    profileId: requestedProfileId,
    dataClient: adminClient,
    delegated: true,
    permissions: {
      view_schedule: relation.can_view_schedule,
      confirm_attendance: relation.can_confirm_attendance,
      view_payments: relation.can_view_payments,
      view_medical_status: relation.can_view_medical_status,
      view_documents: relation.can_view_documents,
      sign_documents: relation.can_sign_documents,
      receive_messages: relation.can_receive_messages,
    },
  }
}

export async function requireSubjectAthleteContext(
  supabase: SupabaseClient,
  requestedProfileId: string | null,
  permission?: SubjectPermission
) {
  const account = await requireAccountContext(supabase)
  const isOwnProfile = !requestedProfileId || requestedProfileId === account.ownerProfileId
  if (isOwnProfile && !account.roles.includes('athlete')) {
    throw new AccountContextError('Ruolo atleta non abilitato', 403)
  }
  const subject = await resolveSubjectProfile(supabase, account, requestedProfileId, permission)
  const { data: athleteProfile } = await subject.dataClient
    .from('athlete_profiles')
    .select('profile_id')
    .eq('profile_id', subject.profileId)
    .maybeSingle()
  const { data: seasonMembership } = await subject.dataClient
    .from('season_profiles')
    .select('profile_id')
    .eq('profile_id', subject.profileId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!athleteProfile || !seasonMembership) {
    throw new AccountContextError('Accesso atleta non abilitato: profilo o iscrizione stagionale attiva mancanti', 403)
  }

  return {
    account,
    profileId: subject.profileId,
    dataClient: subject.dataClient,
    delegated: subject.delegated,
    permissions: subject.permissions,
  }
}
