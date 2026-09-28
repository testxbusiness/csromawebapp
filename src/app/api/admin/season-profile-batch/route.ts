import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'
import { applyProfileBatch, profileBatchSchema } from '@/server/admin/season-rollover-profile-batch'

export async function POST(request: NextRequest) {
  try {
    const account = await requireGlobalRole(await createClient(), 'admin')
    const parsed = profileBatchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Selezioni profili non valide' }, { status: 400 })
    return NextResponse.json(await applyProfileBatch(parsed.data, account.authUserId))
  } catch (error) {
    if (error instanceof AccountContextError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Impossibile applicare le iscrizioni della stagione' }, { status: 409 })
  }
}
