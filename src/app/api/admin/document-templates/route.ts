import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sanitizeHtml } from '@/lib/utils/sanitizeHtml'
import { documentTemplateCreateSchema, documentTemplateUpdateSchema } from '@/lib/validation/documents'

async function getAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, response: NextResponse.json({ error: 'Non autenticato' }, { status: 401 }) }
  if (user.app_metadata?.role !== 'admin') {
    return { supabase, user: null, response: NextResponse.json({ error: 'Accesso negato' }, { status: 403 }) }
  }
  return { supabase, user, response: null }
}

export async function POST(request: Request) {
  const auth = await getAdmin()
  if (auth.response) return auth.response
  const parsed = documentTemplateCreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Dati template non validi' }, { status: 400 })

  const safeHtml = sanitizeHtml(parsed.data.content_html)
  const { data, error } = await auth.supabase
    .from('document_templates')
    .insert({
      name: parsed.data.name,
      target_type: parsed.data.target_type,
      type: parsed.data.type,
      logo_position: parsed.data.logo_position,
      has_logo: parsed.data.has_logo,
      content: safeHtml,
      content_html: safeHtml,
      created_by: auth.user!.id,
    })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: 'Errore salvataggio template' }, { status: 400 })
  return NextResponse.json({ data }, { status: 201 })
}

export async function PATCH(request: Request) {
  const auth = await getAdmin()
  if (auth.response) return auth.response
  const parsed = documentTemplateUpdateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Dati template non validi' }, { status: 400 })

  const safeHtml = sanitizeHtml(parsed.data.content_html)
  const { error } = await auth.supabase
    .from('document_templates')
    .update({
      name: parsed.data.name,
      target_type: parsed.data.target_type,
      type: parsed.data.type,
      logo_position: parsed.data.logo_position,
      has_logo: parsed.data.has_logo,
      content: safeHtml,
      content_html: safeHtml,
    })
    .eq('id', parsed.data.id)
  if (error) return NextResponse.json({ error: 'Errore salvataggio template' }, { status: 400 })
  return NextResponse.json({ ok: true })
}
