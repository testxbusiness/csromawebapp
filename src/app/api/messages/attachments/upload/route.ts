import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Authorize roles admin/coach
    const role = (user as any)?.user_metadata?.role
    if (!['admin', 'coach'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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

