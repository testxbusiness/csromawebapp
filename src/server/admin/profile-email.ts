import { createAdminClient } from '@/lib/supabase/server'

type AdminClient = ReturnType<typeof createAdminClient>

type SyncResult =
  | { ok: true }
  | { ok: false; error: string }

/**
 * Keeps the contact email and the Auth login email aligned for provisioned
 * accounts. Profiles without an account only need the public profile update.
 *
 * Auth and public tables cannot be updated in one database transaction, so a
 * failed profile write is compensated by restoring the previous Auth email.
 */
export async function syncProfileEmail(
  adminClient: AdminClient,
  profileId: string,
  email: string | null | undefined,
): Promise<SyncResult> {
  const [{ data: profile, error: profileLookupError }, { data: account, error: accountLookupError }] = await Promise.all([
    adminClient.from('profiles').select('email').eq('id', profileId).maybeSingle(),
    adminClient.from('app_accounts').select('auth_user_id').eq('owner_profile_id', profileId).maybeSingle(),
  ])

  if (profileLookupError || !profile) return { ok: false, error: 'Profilo non trovato' }
  if (accountLookupError) return { ok: false, error: 'Impossibile verificare l’account collegato' }

  if (!account?.auth_user_id) {
    const { error } = await adminClient.from('profiles').update({ email: email ?? null }).eq('id', profileId)
    return error ? { ok: false, error: 'Impossibile aggiornare l’email' } : { ok: true }
  }

  if (!email) {
    return { ok: false, error: 'Un account collegato richiede un’email di accesso' }
  }

  const { data: authData, error: authLookupError } = await adminClient.auth.admin.getUserById(account.auth_user_id)
  if (authLookupError || !authData.user) return { ok: false, error: 'Impossibile verificare l’email dell’account' }

  const previousAuthEmail = authData.user.email ?? null
  const authNeedsUpdate = previousAuthEmail?.toLowerCase() !== email.toLowerCase()

  if (authNeedsUpdate) {
    const { error } = await adminClient.auth.admin.updateUserById(account.auth_user_id, { email })
    if (error) {
      if (error.code === 'email_exists' || error.message.toLowerCase().includes('already')) {
        return { ok: false, error: 'L’email è già associata a un altro account Auth' }
      }
      return { ok: false, error: 'Impossibile aggiornare l’email dell’account' }
    }
  }

  const { error: profileError } = await adminClient.from('profiles').update({ email }).eq('id', profileId)
  if (!profileError) return { ok: true }

  if (authNeedsUpdate && previousAuthEmail) {
    const { error: rollbackError } = await adminClient.auth.admin.updateUserById(account.auth_user_id, { email: previousAuthEmail })
    if (rollbackError) console.error('Impossibile ripristinare l’email Auth dopo errore profilo:', rollbackError)
  }
  return { ok: false, error: 'Impossibile aggiornare l’email' }
}
