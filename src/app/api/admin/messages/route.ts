import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendToUsers } from '@/lib/utils/push'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    const body = await request.json()
    
    const {
      subject,
      content,
      attachment_url,
      attachments,
      selected_teams,
      selected_users
    } = body

    // Verifica che l'utente corrente sia admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (user as any)?.user_metadata?.role
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Crea il messaggio
    const { data: message, error: messageError } = await adminClient
      .from('messages')
      .insert({
        subject,
        content,
        attachment_url: attachment_url || null,
        created_by: user.id
      })
      .select('id')
      .single()

    if (messageError || !message) {
      console.error('Errore creazione messaggio:', messageError)
      return NextResponse.json({ error: 'Errore creazione messaggio' }, { status: 400 })
    }

    // Allegati multipli
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      const rows = attachments.map((f: any) => ({
        message_id: message.id,
        file_path: f.file_path,
        file_name: f.file_name,
        mime_type: f.mime_type,
        file_size: f.file_size,
        created_by: user.id,
      }))
      const { error: attErr } = await adminClient.from('message_attachments').insert(rows)
      if (attErr) {
        console.error('Errore inserimento allegati:', attErr)
      }
    }

    // Gestisci destinatari squadre
    if (selected_teams && selected_teams.length > 0) {
      const teamRecipients = selected_teams.map((team_id: string) => ({
        message_id: message.id,
        team_id,
        is_read: false
      }))

      const { error: teamError } = await adminClient
        .from('message_recipients')
        .insert(teamRecipients)

      if (teamError) {
        console.error('Errore assegnazione squadre messaggio:', teamError)
      }
    }

    // Gestisci destinatari utenti
    if (selected_users && selected_users.length > 0) {
      const userRecipients = selected_users.map((user_id: string) => ({
        message_id: message.id,
        profile_id: user_id,
        is_read: false
      }))

      const { error: userError } = await adminClient
        .from('message_recipients')
        .insert(userRecipients)

      if (userError) {
        console.error('Errore assegnazione utenti messaggio:', userError)
      }
    }

    // Push notifications to recipients (athletes/coaches)
    try {
      const recipientIds = new Set<string>()
      if (Array.isArray(selected_users)) selected_users.forEach((id: string) => id !== user.id && recipientIds.add(id))
      if (Array.isArray(selected_teams) && selected_teams.length > 0) {
        // team members
        const { data: members } = await adminClient
          .from('team_members')
          .select('profile_id')
          .in('team_id', selected_teams)
        members?.forEach((m: any) => m.profile_id && m.profile_id !== user.id && recipientIds.add(m.profile_id))
        // team coaches
        const { data: coaches } = await adminClient
          .from('team_coaches')
          .select('coach_id')
          .in('team_id', selected_teams)
        coaches?.forEach((c: any) => c.coach_id && c.coach_id !== user.id && recipientIds.add(c.coach_id))
      }
      // Build role-based URLs
      if (recipientIds.size > 0) {
        const ids = Array.from(recipientIds)
        const { data: profiles } = await adminClient.from('profiles').select('id, role').in('id', ids)
        const byRole: Record<string, string[]> = { coach: [], athlete: [], admin: [] }
        profiles?.forEach((p: any) => {
          if (p.role === 'coach') byRole.coach.push(p.id)
          else if (p.role === 'athlete') byRole.athlete.push(p.id)
          else byRole.admin.push(p.id)
        })
        await Promise.all([
          byRole.coach.length ? sendToUsers(byRole.coach, { title: 'Nuovo messaggio', body: subject, url: '/coach/messages', icon: '/images/logo_CSRoma.png', badge: '/favicon.ico' }) : Promise.resolve(),
          byRole.athlete.length ? sendToUsers(byRole.athlete, { title: 'Nuovo messaggio', body: subject, url: '/athlete/messages', icon: '/images/logo_CSRoma.png', badge: '/favicon.ico' }) : Promise.resolve(),
          byRole.admin.length ? sendToUsers(byRole.admin, { title: 'Nuovo messaggio', body: subject, url: '/admin/messages', icon: '/images/logo_CSRoma.png', badge: '/favicon.ico' }) : Promise.resolve(),
        ])
      }
    } catch (e) {
      console.error('push notify (admin messages) error:', e)
    }

    return NextResponse.json({ 
      success: true, 
      message_id: message.id,
      message: 'Messaggio creato con successo'
    })

  } catch (error) {
    console.error('Errore API creazione messaggio:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    const body = await request.json()
    
    const {
      id,
      subject,
      content,
      attachment_url,
      attachments,
      selected_teams,
      selected_users
    } = body

    // Verifica che l'utente corrente sia admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (user as any)?.user_metadata?.role
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!id) {
      return NextResponse.json({ error: 'ID messaggio richiesto' }, { status: 400 })
    }

    // Aggiorna il messaggio
    const { error: messageError } = await adminClient
      .from('messages')
      .update({
        subject,
        content,
        attachment_url: attachment_url || null
      })
      .eq('id', id)

    if (messageError) {
      console.error('Errore aggiornamento messaggio:', messageError)
      return NextResponse.json({ error: 'Errore aggiornamento messaggio' }, { status: 400 })
    }

    // Sincronizza allegati
    if (attachments && Array.isArray(attachments)) {
      const { data: existing } = await adminClient
        .from('message_attachments')
        .select('id, file_path')
        .eq('message_id', id)

      const keepPaths = new Set(attachments.map((a: any) => a.file_path))
      const toDelete = (existing || []).filter((e: any) => !keepPaths.has(e.file_path))

      if (toDelete.length > 0) {
        // delete metadata
        const { error: delMetaErr } = await adminClient
          .from('message_attachments')
          .delete()
          .in('id', toDelete.map((d: any) => d.id))
        if (delMetaErr) console.error('Errore delete metadata allegati:', delMetaErr)

        // delete storage objects
        const { error: delStorErr } = await adminClient
          // @ts-ignore
          .storage.from('message-attachments').remove(toDelete.map((d: any) => d.file_path))
        if (delStorErr) console.error('Errore delete file storage:', delStorErr)
      }

      // insert new attachments
      const existingPaths = new Set((existing || []).map((e: any) => e.file_path))
      const toInsert = attachments.filter((a: any) => !existingPaths.has(a.file_path))
      if (toInsert.length > 0) {
        const rows = toInsert.map((f: any) => ({
          message_id: id,
          file_path: f.file_path,
          file_name: f.file_name,
          mime_type: f.mime_type,
          file_size: f.file_size,
          created_by: user.id,
        }))
        const { error: insErr } = await adminClient.from('message_attachments').insert(rows)
        if (insErr) console.error('Errore inserimento nuovi allegati:', insErr)
      }
    }

    // Rimuovi destinatari esistenti
    await adminClient
      .from('message_recipients')
      .delete()
      .eq('message_id', id)

    // Gestisci destinatari squadre
    if (selected_teams && selected_teams.length > 0) {
      const teamRecipients = selected_teams.map((team_id: string) => ({
        message_id: id,
        team_id,
        is_read: false
      }))

      const { error: teamError } = await adminClient
        .from('message_recipients')
        .insert(teamRecipients)

      if (teamError) {
        console.error('Errore assegnazione squadre messaggio:', teamError)
      }
    }

    // Gestisci destinatari utenti
    if (selected_users && selected_users.length > 0) {
      const userRecipients = selected_users.map((user_id: string) => ({
        message_id: id,
        profile_id: user_id,
        is_read: false
      }))

      const { error: userError } = await adminClient
        .from('message_recipients')
        .insert(userRecipients)

      if (userError) {
        console.error('Errore assegnazione utenti messaggio:', userError)
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Messaggio aggiornato con successo'
    })

  } catch (error) {
    console.error('Errore API aggiornamento messaggio:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    
    // Verifica che l'utente corrente sia admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (user as any)?.user_metadata?.role
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Prima ottieni solo i messaggi base
    const { data: messagesData, error } = await adminClient
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Ora arricchisci con i dati correlati
    const enrichedMessages = await Promise.all(
      (messagesData || []).map(async (message) => {
        const enrichedMessage = { ...message }

        // Ottieni dati creatore
        if (message.created_by) {
          const { data: profileData } = await adminClient
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', message.created_by)
            .single()
          
          if (profileData) {
            enrichedMessage.created_by_profile = profileData
          }
        }

        // Ottieni destinatari
        const { data: recipients } = await adminClient
          .from('message_recipients')
          .select('id, is_read, read_at, team_id, profile_id')
          .eq('message_id', message.id)

        if (recipients && recipients.length > 0) {
          enrichedMessage.message_recipients = []

          for (const recipient of recipients) {
            const recipientData: any = {
              id: recipient.id,
              is_read: recipient.is_read,
              read_at: recipient.read_at
            }

            if (recipient.team_id) {
              const { data: teamData } = await adminClient
                .from('teams')
                .select('id, name')
                .eq('id', recipient.team_id)
                .single()
              
              if (teamData) {
                recipientData.teams = teamData
              }
            }

            if (recipient.profile_id) {
              const { data: profileData } = await adminClient
                .from('profiles')
                .select('id, first_name, last_name, email')
                .eq('id', recipient.profile_id)
                .single()
              
              if (profileData) {
                recipientData.profiles = profileData
              }
            }

            enrichedMessage.message_recipients.push(recipientData)
          }
        }

        // Allegati firmati
        const { data: atts } = await adminClient
          .from('message_attachments')
          .select('id, file_path, file_name, mime_type, file_size')
          .eq('message_id', message.id)

        if (atts && atts.length > 0) {
          const files = [] as any[]
          for (const a of atts) {
            const { data: signed } = await adminClient
              // @ts-ignore
              .storage.from('message-attachments').createSignedUrl(a.file_path, 3600)
            files.push({
              id: a.id,
              file_path: a.file_path,
              file_name: a.file_name,
              mime_type: a.mime_type,
              file_size: a.file_size,
              download_url: signed?.signedUrl || null,
            })
          }
          ;(enrichedMessage as any).attachments = files
        }

        return enrichedMessage
      })
    )

    return NextResponse.json({ messages: enrichedMessages })

  } catch (error) {
    console.error('Errore API lista messaggi:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    
    // Verifica che l'utente corrente sia admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (user as any)?.user_metadata?.role
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get('id')
    
    if (!messageId) {
      return NextResponse.json({ error: 'ID messaggio richiesto' }, { status: 400 })
    }

    // 1. Elimina i destinatari
    await adminClient
      .from('message_recipients')
      .delete()
      .eq('message_id', messageId)

    // 2. Elimina file allegati
    const { data: attToDelete } = await adminClient
      .from('message_attachments')
      .select('file_path')
      .eq('message_id', messageId)
    if (attToDelete && attToDelete.length > 0) {
      const { error: storErr } = await adminClient
        // @ts-ignore
        .storage.from('message-attachments').remove(attToDelete.map((a: any) => a.file_path))
      if (storErr) console.error('Errore rimozione allegati storage:', storErr)
    }

    // 3. Elimina il messaggio
    const { error: messageError } = await adminClient
      .from('messages')
      .delete()
      .eq('id', messageId)

    if (messageError) {
      console.error('Errore eliminazione messaggio:', messageError)
      return NextResponse.json({ error: 'Errore eliminazione messaggio' }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Messaggio eliminato con successo'
    })

  } catch (error) {
    console.error('Errore API eliminazione messaggio:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
