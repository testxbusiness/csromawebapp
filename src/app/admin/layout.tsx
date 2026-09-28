import { redirect } from 'next/navigation'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Page-level boundary for the admin area. API/RLS checks remain authoritative
 * for data access; this prevents non-admin accounts from mounting the admin UI.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireGlobalRole(await createClient(), 'admin')
  } catch (error) {
    if (error instanceof AccountContextError && error.status === 401) {
      redirect('/login?next=%2Fadmin')
    }
    if (error instanceof AccountContextError && error.status === 403) {
      redirect('/unauthorized')
    }
    throw error
  }

  return children
}
