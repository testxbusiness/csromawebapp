import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

let recoveryClient: ReturnType<typeof createSupabaseClient> | null = null

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Password recovery is initiated by an administrator and the recipient may
// open the email after the administrator has logged out. Use the implicit
// recovery flow here so the link does not depend on the admin browser's PKCE
// verifier. The resulting tokens stay in the URL fragment and are consumed by
// /auth/callback without being sent to the server.
export function createRecoveryClient() {
  if (!recoveryClient) {
    recoveryClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          flowType: 'implicit',
          detectSessionInUrl: false,
          persistSession: false,
        },
      },
    )
  }

  return recoveryClient
}
