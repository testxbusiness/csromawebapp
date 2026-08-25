import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  AccountContextError,
  type AccountContext,
  type AccountRole,
  requireAccountContext,
} from '@/server/auth/require-account-context'

export async function requireGlobalRole(
  client: SupabaseClient,
  role: AccountRole
): Promise<AccountContext> {
  const account = await requireAccountContext(client)

  if (!account.roles.includes(role)) {
    throw new AccountContextError('Ruolo globale non autorizzato', 403)
  }

  return account
}
