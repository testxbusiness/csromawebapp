import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { requireGlobalRole } from '@/server/auth/require-global-role'

const requestSchema = z.object({
  championship_id: z.string().uuid(),
  status: z.enum(['draft', 'published', 'archived']),
})

export async function PATCH(request: NextRequest) {
  try {
    await requireGlobalRole(await createClient(), 'admin')
    const parsed = requestSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Dati stato campionato non validi' }, { status: 400 })

    const { error } = await createAdminClient()
      .from('championships')
      .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
      .eq('id', parsed.data.championship_id)
    if (error) return NextResponse.json({ error: 'Impossibile aggiornare lo stato del campionato' }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (error) {
    const status = error instanceof Error && 'status' in error && typeof error.status === 'number' ? error.status : 500
    return NextResponse.json({ error: status === 403 ? 'Operazione non autorizzata' : 'Errore interno del server' }, { status })
  }
}
