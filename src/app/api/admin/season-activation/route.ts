import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'
import { activateSeason, seasonActivationSchema } from '@/server/admin/season-activation'

export async function POST(request: NextRequest) {
  try {
    const account = await requireGlobalRole(await createClient(), 'admin')
    const parsed = seasonActivationSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Richiesta di attivazione non valida' }, { status: 400 })

    return NextResponse.json(await activateSeason(parsed.data, account.authUserId))
  } catch (error) {
    if (error instanceof AccountContextError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Impossibile attivare la stagione' }, { status: 409 })
  }
}
