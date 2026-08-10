import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { AccountContextError, requireAccountContext } from '@/server/auth/require-account-context'

export async function requireRelationshipManager(client: SupabaseClient) {
  const account = await requireAccountContext(client)
  if (!account.roles.includes('admin') && !account.roles.includes('staff')) {
    throw new AccountContextError('Capability relazioni non autorizzata', 403)
  }
  return account
}
