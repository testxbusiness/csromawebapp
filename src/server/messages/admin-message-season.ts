import 'server-only'

import type { createAdminClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'

type AdminClient = ReturnType<typeof createAdminClient>

export type MessageSeason = {
  id: string
  name: string
  is_active: boolean
}

export type MessageTeamOption = {
  id: string
  name: string
  code: string | null
}

export type MessageUserOption = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  role: string | null
}

export type AdminMessageSeasonScope = {
  seasons: MessageSeason[]
  selectedSeasonId: string
  teams: MessageTeamOption[]
  users: MessageUserOption[]
  recipientProfiles: MessageUserOption[]
  teamIds: Set<string>
  profileIds: Set<string>
  selectableProfileIds: Set<string>
}

const rolePriority = ['admin', 'coach', 'staff', 'athlete', 'family_member'] as const

function resolveRole(roles: string[] | undefined): string | null {
  return rolePriority.find((role) => roles?.includes(role)) ?? roles?.[0] ?? null
}

export async function resolveAdminMessageSeasonScope(
  admin: AdminClient,
  requestedSeasonId?: string | null,
): Promise<AdminMessageSeasonScope> {
  const { data: seasons, error: seasonsError } = await admin
    .from('seasons')
    .select('id, name, is_active')
    .order('start_date', { ascending: false })
  if (seasonsError) throw new AccountContextError('Impossibile caricare le stagioni dei messaggi', 500)

  const seasonList = (seasons ?? []) as MessageSeason[]
  const selectedSeason = requestedSeasonId
    ? seasonList.find((season) => season.id === requestedSeasonId)
    : seasonList.find((season) => season.is_active)
  if (!selectedSeason) {
    throw new AccountContextError(
      requestedSeasonId ? 'Stagione messaggi non valida' : 'Nessuna stagione attiva configurata',
      requestedSeasonId ? 400 : 500,
    )
  }

  const { data: activities, error: activitiesError } = await admin
    .from('activities')
    .select('id')
    .eq('season_id', selectedSeason.id)
  if (activitiesError) throw new AccountContextError('Impossibile caricare le attività della stagione', 500)
  const activityIds = (activities ?? []).map((activity) => activity.id as string)

  const { data: teams, error: teamsError } = activityIds.length > 0
    ? await admin.from('teams').select('id, name, code').in('activity_id', activityIds).order('name')
    : { data: [] as MessageTeamOption[], error: null }
  if (teamsError) throw new AccountContextError('Impossibile caricare le squadre della stagione', 500)

  const { data: seasonProfiles, error: seasonProfilesError } = await admin
    .from('season_profiles')
    .select('profile_id, status')
    .eq('season_id', selectedSeason.id)
  if (seasonProfilesError) throw new AccountContextError('Impossibile caricare i profili della stagione', 500)
  const seasonProfileIds = [...new Set((seasonProfiles ?? []).map((row) => row.profile_id as string))]
  const activeSeasonProfileIds = [...new Set((seasonProfiles ?? [])
    .filter((row) => row.status === 'active')
    .map((row) => row.profile_id as string))]

  const today = new Date().toISOString().slice(0, 10)
  const { data: familyRelations, error: familyRelationsError } = activeSeasonProfileIds.length > 0
    ? await admin
        .from('profile_relationships')
        .select('source_profile_id')
        .in('target_profile_id', activeSeasonProfileIds)
        .eq('status', 'active')
        .eq('can_receive_messages', true)
        .lte('valid_from', today)
        .or(`valid_until.is.null,valid_until.gte.${today}`)
    : { data: [] as Array<{ source_profile_id: string }>, error: null }
  if (familyRelationsError) throw new AccountContextError('Impossibile caricare i familiari della stagione', 500)

  const familyProfileIds = (familyRelations ?? []).map((row) => row.source_profile_id as string)
  const visibleProfileIds = [...new Set([
    ...seasonProfileIds,
    ...familyProfileIds,
  ])]
  const selectableCandidateIds = [...new Set([...activeSeasonProfileIds, ...familyProfileIds])]
  if (visibleProfileIds.length === 0) {
    const resolvedTeams = (teams ?? []) as MessageTeamOption[]
    return {
      seasons: seasonList,
      selectedSeasonId: selectedSeason.id,
      teams: resolvedTeams,
      users: [],
      recipientProfiles: [],
      teamIds: new Set(resolvedTeams.map((team) => team.id)),
      profileIds: new Set(),
      selectableProfileIds: new Set(),
    }
  }

  const { data: accounts, error: accountsError } = selectableCandidateIds.length > 0
    ? await admin
        .from('app_accounts')
        .select('owner_profile_id, auth_user_id, status')
        .in('owner_profile_id', selectableCandidateIds)
        .eq('status', 'active')
    : { data: [], error: null }
  if (accountsError) throw new AccountContextError('Impossibile caricare gli account destinatari', 500)

  const activeAccounts = accounts ?? []
  const ownerProfileIds = new Set(activeAccounts.map((account) => account.owner_profile_id as string))
  const authUserIds = activeAccounts.map((account) => account.auth_user_id as string)
  const [{ data: profiles, error: profilesError }, { data: accountRoles, error: rolesError }] = await Promise.all([
    admin.from('profiles').select('id, first_name, last_name, email').in('id', visibleProfileIds),
    authUserIds.length > 0
      ? admin.from('account_roles').select('auth_user_id, role').in('auth_user_id', authUserIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (profilesError || rolesError) throw new AccountContextError('Impossibile caricare i destinatari della stagione', 500)

  const rolesByAuthUser = new Map<string, string[]>()
  for (const row of accountRoles ?? []) {
    const roles = rolesByAuthUser.get(row.auth_user_id as string) ?? []
    roles.push(row.role as string)
    rolesByAuthUser.set(row.auth_user_id as string, roles)
  }
  const authUserByProfile = new Map(activeAccounts.map((account) => [account.owner_profile_id as string, account.auth_user_id as string]))
  const recipientProfiles = (profiles ?? []).map((profile) => ({
    id: profile.id as string,
    first_name: (profile.first_name as string | null) ?? '',
    last_name: (profile.last_name as string | null) ?? '',
    email: profile.email as string | null,
    role: resolveRole(rolesByAuthUser.get(authUserByProfile.get(profile.id as string) ?? '')),
  }))
  const users = recipientProfiles
    .filter((profile) => ownerProfileIds.has(profile.id))
    .sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`, 'it'))
  const resolvedTeams = (teams ?? []) as MessageTeamOption[]

  return {
    seasons: seasonList,
    selectedSeasonId: selectedSeason.id,
    teams: resolvedTeams,
    users,
    recipientProfiles,
    teamIds: new Set(resolvedTeams.map((team) => team.id)),
    profileIds: new Set(recipientProfiles.map((profile) => profile.id)),
    selectableProfileIds: new Set(users.map((user) => user.id)),
  }
}

export function assertMessageRecipientsInSeason(
  scope: AdminMessageSeasonScope,
  selectedTeamIds: string[] = [],
  selectedProfileIds: string[] = [],
) {
  if (selectedTeamIds.some((teamId) => !scope.teamIds.has(teamId))) {
    throw new AccountContextError('Una o più squadre non appartengono alla stagione selezionata', 403)
  }
  if (selectedProfileIds.some((profileId) => !scope.selectableProfileIds.has(profileId))) {
    throw new AccountContextError('Uno o più utenti non sono destinatari attivi della stagione selezionata', 403)
  }
}
