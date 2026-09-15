import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'
import { applyStructureChoices, getStructurePreview, structureChoiceItemSchema } from '@/server/admin/season-rollover-structures'

const ids = z.object({ sourceSeasonId: z.string().uuid(), targetSeasonId: z.string().uuid() }).strict()
const bodySchema = ids.extend({ gyms: z.array(structureChoiceItemSchema), activities: z.array(structureChoiceItemSchema) }).strict()

async function authorize() {
  const client = await createClient()
  await requireGlobalRole(client, 'admin')
}

export async function GET(request: NextRequest) {
  try {
    await authorize()
    const parsed = ids.safeParse(Object.fromEntries(new URL(request.url).searchParams))
    if (!parsed.success) return NextResponse.json({ error: 'Stagioni non valide' }, { status: 400 })
    return NextResponse.json(await getStructurePreview(parsed.data.sourceSeasonId, parsed.data.targetSeasonId))
  } catch (error) {
    if (error instanceof AccountContextError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: 'Impossibile leggere la preview delle strutture' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await authorize()
    const parsed = bodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Scelte strutture non valide' }, { status: 400 })
    return NextResponse.json(await applyStructureChoices(parsed.data.sourceSeasonId, parsed.data.targetSeasonId, parsed.data.gyms, parsed.data.activities))
  } catch (error) {
    if (error instanceof AccountContextError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Impossibile applicare le scelte delle strutture' }, { status: 409 })
  }
}
