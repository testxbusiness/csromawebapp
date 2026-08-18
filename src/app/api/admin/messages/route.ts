import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { adminMessageCreateSchema, adminMessageUpdateSchema } from '@/lib/validation/messages'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'
import { notifyMessageRecipients } from '@/server/messages/push-notifications'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const account = await requireGlobalRole(supabase, 'admin')
    const adminClient = createAdminClient()
    const parsed = adminMessageCreateSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      console.warn('Admin message validation failed:', parsed.error.issues.map((issue) => ({
        path: issue.path,
        code: issue.code,
        message: issue.message,
      })))
      return NextResponse.json({ error: 'Dati messaggio non validi' }, { status: 400 })
    }
    const { subject, content, attachment_url, attachments, selected_teams, selected_users } = parsed.data

    // Crea il messaggio
    const { data: message, error: messageError } = await adminClient
      .from('messages')
      .insert({
        subject,
        content,
        attachment_url: attachment_url || null,
        created_by: account.ownerProfileId
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
        created_by: account.ownerProfileId,
      }))
      const { error: attErr } = await adminClient.from('message_attachments').insert(rows)
      if (attErr) {
        console.error('Errore inserimento allegati:', attErr)
      }
    }

    // Gestisci destinatari squadre (PATCH: aggiunto recipient_type e profile_id: null)
    if (selected_teams && selected_teams.length > 0) {
      const teamRecipients = selected_teams.map((team_id: string) => ({
        message_id: message.id,
        recipient_type: 'team',
        team_id,
        profile_id: null,
        is_read: false
      }))

      const { error: teamError } = await adminClient
        .from('message_recipients')
        .insert(teamRecipients)

      if (teamError) {
        console.error('Errore assegnazione squadre messaggio:', teamError)
      }
    }

    // Gestisci destinatari utenti (PATCH: recipient_type 'user' e team_id: null)
    if (selected_users && selected_users.length > 0) {
      const userRecipients = selected_users.map((user_id: string) => ({
        message_id: message.id,
        recipient_type: 'user',
        team_id: null,
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

    // Push notifications to account destinatari e familiari autorizzati.
    try {
      await notifyMessageRecipients({
        adminClient,
        subject,
        senderProfileId: account.ownerProfileId,
        selectedTeamIds: selected_teams,
        selectedProfileIds: selected_users,
      })
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
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const account = await requireGlobalRole(supabase, 'admin')
    const adminClient = createAdminClient()
    const parsed = adminMessageUpdateSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      console.warn('Admin message update validation failed:', parsed.error.issues.map((issue) => ({
        path: issue.path,
        code: issue.code,
        message: issue.message,
      })))
      return NextResponse.json({ error: 'Dati aggiornamento messaggio non validi' }, { status: 400 })
    }
    const { id, subject, content, attachment_url, attachments, selected_teams, selected_users } = parsed.data

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
          created_by: account.ownerProfileId,
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

    // Gestisci destinatari squadre (PATCH: aggiunto recipient_type e profile_id: null)
    if (selected_teams && selected_teams.length > 0) {
      const teamRecipients = selected_teams.map((team_id: string) => ({
        message_id: id,
        recipient_type: 'team',
        team_id,
        profile_id: null,
        is_read: false
      }))

      const { error: teamError } = await adminClient
        .from('message_recipients')
        .insert(teamRecipients)

      if (teamError) {
        console.error('Errore assegnazione squadre messaggio:', teamError)
      }
    }

    // Gestisci destinatari utenti (PATCH: recipient_type 'user' e team_id: null)
    if (selected_users && selected_users.length > 0) {
      const userRecipients = selected_users.map((user_id: string) => ({
        message_id: id,
        recipient_type: 'user',
        team_id: null,
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
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    await requireGlobalRole(supabase, 'admin')
    const adminClient = createAdminClient()

    // Prima ottieni solo i messaggi base
    const { data: messagesData, error } = await adminClient
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const [{ data: appAccounts }, { data: accountRoles }] = await Promise.all([
      adminClient.from('app_accounts').select('owner_profile_id, auth_user_id'),
      adminClient.from('account_roles').select('auth_user_id, role'),
    ])
    const authUserByProfile = new Map((appAccounts || []).map((account) => [account.owner_profile_id, account.auth_user_id]))
    const rolesByAuthUser = new Map<string, string[]>()
    for (const row of accountRoles || []) {
      const roles = rolesByAuthUser.get(row.auth_user_id) || []
      roles.push(row.role)
      rolesByAuthUser.set(row.auth_user_id, roles)
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
                .select('id, first_name, last_name, email, role')
                .eq('id', recipient.profile_id)
                .single()
              
              if (profileData) {
                const authUserId = authUserByProfile.get(profileData.id)
                recipientData.profiles = {
                  ...profileData,
                  role: authUserId ? (rolesByAuthUser.get(authUserId) || [profileData.role]).filter(Boolean)[0] || null : profileData.role,
                }
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
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    await requireGlobalRole(supabase, 'admin')
    const adminClient = createAdminClient()

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
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
