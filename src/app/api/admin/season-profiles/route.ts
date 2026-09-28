import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'
import { getProfilePreview } from '@/server/admin/season-rollover-profiles'

const querySchema = z.object({ sourceSeasonId: z.string().uuid(), targetSeasonId: z.string().uuid() }).strict()

export async function GET(request: NextRequest) {
  try {
    await requireGlobalRole(await createClient(), 'admin')
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
    if (!parsed.success) return NextResponse.json({ error: 'Stagioni non valide' }, { status: 400 })
    return NextResponse.json(await getProfilePreview(parsed.data.sourceSeasonId, parsed.data.targetSeasonId))
  } catch (error) {
    if (error instanceof AccountContextError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: 'Impossibile leggere la preview dei profili' }, { status: 500 })
  }
}
