import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasValidMagicBytes } from '@/lib/utils/fileValidation'
import { cleanupOrphanedDraftAttachments } from '@/lib/utils/cleanupDraftAttachments'

const MAX_FILES = 5
const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_TOTAL_SIZE = 25 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/webp',
])

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Authorize roles admin/coach
const role = (user as any)?.app_metadata?.role
    if (!['admin', 'coach'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Cleanup non-blocking dei draft vecchi e non ancora associati a un messaggio.
    try {
      await cleanupOrphanedDraftAttachments(user.id)
    } catch (cleanupError) {
      console.warn('Cleanup draft allegati non riuscito:', cleanupError)
    }

    const form = await request.formData()
    const files: File[] = []
    for (const [key, value] of form.entries()) {
      if (key === 'file' || key === 'files') {
        if (value instanceof File) files.push(value)
      }
    }

    const messageId = form.get('message_id')?.toString() || null

    if (files.length === 0) {
      return NextResponse.json({ error: 'Nessun file fornito' }, { status: 400 })
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Sono consentiti al massimo ${MAX_FILES} file` }, { status: 400 })
    }

    const totalSize = files.reduce((sum, file) => sum + file.size, 0)
    if (totalSize > MAX_TOTAL_SIZE) {
      return NextResponse.json({ error: 'La dimensione totale degli allegati supera 25 MB' }, { status: 413 })
    }

    for (const file of files) {
      if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `Ogni file deve avere una dimensione tra 1 byte e 10 MB: ${file.name}` }, { status: 413 })
      }
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        return NextResponse.json({ error: `Tipo di file non consentito: ${file.name}` }, { status: 415 })
      }

      const bytes = new Uint8Array(await file.slice(0, Math.min(file.size, 64 * 1024)).arrayBuffer())
      if (!hasValidMagicBytes(file.type, bytes)) {
        return NextResponse.json({ error: `Il contenuto del file non corrisponde al tipo dichiarato: ${file.name}` }, { status: 415 })
      }
    }

    // Un allegato associato a un messaggio esistente può essere caricato
    // solo dal suo autore (oppure da un admin). I draft restano personali.
    if (messageId) {
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .select('id, created_by')
        .eq('id', messageId)
        .maybeSingle()

      if (messageError || !message || (role !== 'admin' && message.created_by !== user.id)) {
        return NextResponse.json({ error: 'Messaggio non autorizzato' }, { status: 403 })
      }
    }

    const uploaded: Array<{ file_path: string; file_name: string; mime_type: string; file_size: number }> = []

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const safeName = file.name.replace(/[^a-zA-Z0-9_.-]+/g, '_')
      const basePath = messageId
        ? `messages/${user.id}/${messageId}`
        : `draft/${user.id}/${crypto.randomUUID()}`
      const objectPath = `${basePath}/${Date.now()}_${safeName}`

      const { error: uploadError } = await supabase
        // @ts-ignore: storage polyfill types
        .storage.from('message-attachments').upload(objectPath, buffer, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        })

      if (uploadError) {
        if (uploaded.length > 0) {
          await supabase.storage.from('message-attachments').remove(uploaded.map((item) => item.file_path))
        }
        return NextResponse.json({ error: `Errore upload: ${uploadError.message}` }, { status: 400 })
      }

      uploaded.push({
        file_path: objectPath,
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
      })
    }

    return NextResponse.json({ success: true, files: uploaded })
  } catch (e: any) {
    console.error('Upload attachments error:', e)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
