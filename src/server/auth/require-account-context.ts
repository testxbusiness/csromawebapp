import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export type AccountRole = 'admin' | 'coach' | 'staff' | 'athlete' | 'family_member'
export type AccountStatus = 'invited' | 'active' | 'suspended' | 'disabled'

export type AccountContext = {
  authUserId: string
  ownerProfileId: string
  accountStatus: AccountStatus
  roles: AccountRole[]
  mustChangePassword: boolean
}

export class AccountContextError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 401 | 403 | 404 | 500
  ) {
    super(message)
    this.name = 'AccountContextError'
  }
}

const accountStatuses = new Set<AccountStatus>(['invited', 'active', 'suspended', 'disabled'])
const accountRoles = new Set<AccountRole>(['admin', 'coach', 'staff', 'athlete', 'family_member'])

export async function requireAccountContext(
  client?: SupabaseClient
): Promise<AccountContext> {
  const supabase = client ?? (await createClient())
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new AccountContextError('Autenticazione richiesta', 401)
  }

  const { data: account, error: accountError } = await supabase
    .from('app_accounts')
    .select('auth_user_id, owner_profile_id, status, must_change_password')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (accountError) {
    throw new AccountContextError('Impossibile risolvere il contesto account', 500)
  }

  if (!account || !accountStatuses.has(account.status as AccountStatus)) {
    throw new AccountContextError('Account non abilitato', 403)
  }

  if (account.status !== 'active') {
    throw new AccountContextError('Account non attivo', 403)
  }

  const { data: roleRows, error: rolesError } = await supabase
    .from('account_roles')
    .select('role')
    .eq('auth_user_id', user.id)

  if (rolesError) {
    throw new AccountContextError('Impossibile risolvere i ruoli account', 500)
  }

  const roles = (roleRows ?? [])
    .map((row) => row.role as AccountRole)
    .filter((role, index, values) => accountRoles.has(role) && values.indexOf(role) === index)

  return {
    authUserId: user.id,
    ownerProfileId: account.owner_profile_id,
    accountStatus: account.status as AccountStatus,
    roles,
    mustChangePassword: account.must_change_password === true,
  }
}

export async function requireAthleteContext(
  client?: SupabaseClient
): Promise<AccountContext> {
  const context = await requireAccountContext(client)
  const supabase = client ?? (await createClient())

  if (!context.roles.includes('athlete')) {
    throw new AccountContextError('Ruolo atleta non abilitato', 403)
  }

  const [{ data: athleteProfile }, { data: seasonMembership }] = await Promise.all([
    supabase
      .from('athlete_profiles')
      .select('profile_id')
      .eq('profile_id', context.ownerProfileId)
      .maybeSingle(),
    supabase
      .from('season_profiles')
      .select('profile_id')
      .eq('profile_id', context.ownerProfileId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle(),
  ])

  if (!athleteProfile || !seasonMembership) {
    throw new AccountContextError('Accesso atleta non abilitato: profilo o iscrizione stagionale attiva mancanti', 403)
  }

  return context
}
