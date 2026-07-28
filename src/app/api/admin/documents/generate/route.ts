import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sanitizeHtml } from '@/lib/utils/sanitizeHtml'
import { generatedDocumentSchema } from '@/lib/validation/documents'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (user.app_metadata?.role !== 'admin') return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })

  const parsed = generatedDocumentSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Dati documento non validi' }, { status: 400 })

  const input = parsed.data
  if ((!input.target_user_id && !input.target_team_id) || (input.target_user_id && input.target_team_id)) {
    return NextResponse.json({ error: 'Destinatario documento non valido' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('documents')
    .insert({
      ...input,
      created_by: user.id,
      generated_content_html: sanitizeHtml(input.generated_content_html),
      generation_date: input.generation_date || new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: 'Errore salvataggio documento' }, { status: 400 })
  return NextResponse.json({ data }, { status: 201 })
}
