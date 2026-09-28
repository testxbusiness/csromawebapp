import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'
import { applyTeamChoices, getTeamPreview, teamChoicesSchema } from '@/server/admin/season-rollover-teams'

const ids = z.object({ sourceSeasonId: z.string().uuid(), targetSeasonId: z.string().uuid() }).strict()
const bodySchema = ids.extend({ teams: teamChoicesSchema }).strict()

async function authorize() {
  await requireGlobalRole(await createClient(), 'admin')
}

export async function GET(request: NextRequest) {
  try {
    await authorize()
    const parsed = ids.safeParse(Object.fromEntries(new URL(request.url).searchParams))
    if (!parsed.success) return NextResponse.json({ error: 'Stagioni non valide' }, { status: 400 })
    return NextResponse.json(await getTeamPreview(parsed.data.sourceSeasonId, parsed.data.targetSeasonId))
  } catch (error) {
    if (error instanceof AccountContextError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: 'Impossibile leggere la preview delle squadre' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await authorize()
    const parsed = bodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Scelte squadre non valide' }, { status: 400 })
    return NextResponse.json(await applyTeamChoices(parsed.data.sourceSeasonId, parsed.data.targetSeasonId, parsed.data.teams))
  } catch (error) {
    if (error instanceof AccountContextError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Impossibile applicare le scelte delle squadre' }, { status: 409 })
  }
}
