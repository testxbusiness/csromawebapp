import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendToUsers } from '@/lib/utils/push'

type MessagePushInput = {
  adminClient: SupabaseClient
  subject: string
  senderProfileId: string
  selectedTeamIds?: string[]
  selectedProfileIds?: string[]
}

type ProfileRow = {
  id: string
  birth_date: string | null
}

type RelationshipRow = {
  source_profile_id: string
  target_profile_id: string
  relationship_type: string
  verified_at: string | null
  valid_from: string
  valid_until: string | null
  can_receive_messages: boolean
}

function isMinor(birthDate: string | null, today: Date): boolean {
  if (!birthDate) return true
  const eighteenthBirthday = new Date(`${birthDate}T00:00:00Z`)
  eighteenthBirthday.setUTCFullYear(eighteenthBirthday.getUTCFullYear() + 18)
  return today < eighteenthBirthday
}

function relationshipAllowsPush(
  relationship: RelationshipRow,
  targetIsMinor: boolean,
  todayIso: string,
): boolean {
  if (!relationship.can_receive_messages) return false
  if (relationship.valid_from > todayIso) return false
  if (relationship.valid_until && relationship.valid_until < todayIso) return false
  if (targetIsMinor) {
    return ['parent', 'guardian', 'caregiver', 'delegate'].includes(relationship.relationship_type)
  }
  return relationship.relationship_type === 'delegate' && relationship.verified_at !== null
}

export async function notifyMessageRecipients({
  adminClient,
  subject,
  senderProfileId,
  selectedTeamIds = [],
  selectedProfileIds = [],
}: MessagePushInput): Promise<void> {
  const recipientProfileIds = new Set(selectedProfileIds)

  if (selectedTeamIds.length > 0) {
    const [{ data: members }, { data: coaches }] = await Promise.all([
      adminClient.from('team_members').select('profile_id').in('team_id', selectedTeamIds),
      adminClient.from('team_coaches').select('coach_id').in('team_id', selectedTeamIds),
    ])
    for (const member of members ?? []) if (member.profile_id) recipientProfileIds.add(member.profile_id)
    for (const coach of coaches ?? []) if (coach.coach_id) recipientProfileIds.add(coach.coach_id)
  }

  recipientProfileIds.delete(senderProfileId)
  const subjectIds = [...recipientProfileIds]
  if (subjectIds.length === 0) return

  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)
  const [{ data: profiles }, { data: overrides }, { data: relationships }] = await Promise.all([
    adminClient.from('profiles').select('id, birth_date').in('id', subjectIds),
    adminClient.from('profile_age_overrides').select('profile_id, treat_as_minor').in('profile_id', subjectIds).eq('active', true),
    adminClient
      .from('profile_relationships')
      .select('source_profile_id, target_profile_id, relationship_type, verified_at, valid_from, valid_until, can_receive_messages')
      .in('target_profile_id', subjectIds)
      .eq('status', 'active')
      .lte('valid_from', todayIso)
      .or(`valid_until.is.null,valid_until.gte.${todayIso}`),
  ])

  const profileById = new Map<string, ProfileRow>((profiles ?? []).map((profile) => [profile.id, profile]))
  const overrideById = new Map<string, boolean>((overrides ?? []).map((override) => [override.profile_id, override.treat_as_minor]))
  const relatedProfileIds = new Set<string>()

  for (const relationship of (relationships ?? []) as RelationshipRow[]) {
    const target = profileById.get(relationship.target_profile_id)
    const targetIsMinor = overrideById.has(relationship.target_profile_id)
      ? overrideById.get(relationship.target_profile_id) === true
      : target ? isMinor(target.birth_date, today) : true
    if (relationshipAllowsPush(relationship, targetIsMinor, todayIso)) {
      relatedProfileIds.add(relationship.source_profile_id)
    }
  }

  const allProfileIds = [...new Set([...subjectIds, ...relatedProfileIds])]
  const [{ data: accounts }, { data: roleRows }] = await Promise.all([
    adminClient.from('app_accounts').select('owner_profile_id, auth_user_id').in('owner_profile_id', allProfileIds),
    adminClient.from('account_roles').select('auth_user_id, role'),
  ])

  const rolesByAuthUser = new Map<string, Set<string>>()
  for (const row of roleRows ?? []) {
    const roles = rolesByAuthUser.get(row.auth_user_id) ?? new Set<string>()
    roles.add(row.role)
    rolesByAuthUser.set(row.auth_user_id, roles)
  }

  const byUrl = new Map<string, string[]>()
  for (const account of accounts ?? []) {
    if (account.owner_profile_id === senderProfileId) continue
    const roles = rolesByAuthUser.get(account.auth_user_id) ?? new Set<string>()
    const url = roles.has('coach')
      ? '/coach/messages'
      : roles.has('athlete')
        ? '/athlete/messages'
        : roles.has('admin')
          ? '/admin/messages'
          : '/dashboard'
    const ids = byUrl.get(url) ?? []
    ids.push(account.owner_profile_id)
    byUrl.set(url, ids)
  }

  await Promise.all([...byUrl.entries()].map(([url, profileIds]) => sendToUsers(profileIds, {
    title: 'Nuovo messaggio',
    body: subject,
    url,
    icon: '/images/logo_CSRoma.png',
    badge: '/favicon.ico',
  })))
}
