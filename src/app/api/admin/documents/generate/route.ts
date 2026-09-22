import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { sanitizeHtml } from '@/lib/utils/sanitizeHtml'
import { generatedDocumentSchema } from '@/lib/validation/documents'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'
import { resolveActiveSeason, resolveActiveSeasonTeamIds } from '@/server/seasons/active-season'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const account = await requireGlobalRole(supabase, 'admin')
    const adminClient = createAdminClient()

  const parsed = generatedDocumentSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Dati documento non validi' }, { status: 400 })

  const input = parsed.data
  if ((!input.target_user_id && !input.target_team_id) || (input.target_user_id && input.target_team_id)) {
    return NextResponse.json({ error: 'Destinatario documento non valido' }, { status: 400 })
  }
  if (input.target_team_id) {
    const activeSeason = await resolveActiveSeason(adminClient)
    if (!activeSeason) return NextResponse.json({ error: 'Nessuna stagione attiva configurata' }, { status: 409 })
    const activeTeamIds = new Set(await resolveActiveSeasonTeamIds(adminClient, activeSeason.id))
    if (!activeTeamIds.has(input.target_team_id) || (input.team_id && input.team_id !== input.target_team_id)) {
      return NextResponse.json({ error: 'La squadra destinataria deve appartenere alla stagione attiva' }, { status: 400 })
    }
  }

  const { data, error } = await supabase
    .from('documents')
    .insert({
      ...input,
      created_by: account.ownerProfileId,
      generated_content_html: sanitizeHtml(input.generated_content_html),
      generation_date: input.generation_date || new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: 'Errore salvataggio documento' }, { status: 400 })
  return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Errore API generazione documento:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
