import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireSubjectAthleteContext } from '@/server/auth/require-subject-profile'
import { buildAthleteMessages } from '@/lib/athlete/messages-contract'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    const { searchParams } = new URL(request.url)
    const view = searchParams.get('view') // 'full' for enriched payload
    const idFilter = searchParams.get('id') || undefined
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 10

    const subject = await requireSubjectAthleteContext(supabase, searchParams.get('subjectProfileId'), 'receive_messages')
    const athleteProfileId = subject.profileId
    const dataClient = subject.dataClient

    // Get athlete team IDs
    const { data: memberships, error: tmErr } = await dataClient
      .from('team_members')
      .select('team_id')
      .eq('profile_id', athleteProfileId)

    if (tmErr) {
      console.error('Error loading athlete team memberships:', tmErr)
      return NextResponse.json({ error: 'Error loading memberships' }, { status: 400 })
    }

    const teamIds = [...new Set((memberships || []).map(m => m.team_id).filter(Boolean))]

    // Get message IDs from recipients (direct or team)
    const orClauses: string[] = []
    orClauses.push(`profile_id.eq.${athleteProfileId}`)
    if (teamIds.length > 0) orClauses.push(`team_id.in.(${teamIds.join(',')})`)

    const { data: recips, error: recErr } = await dataClient
      .from('message_recipients')
      .select('id, message_id, team_id, profile_id')
      .or(orClauses.join(','))
      .order('created_at', { ascending: false })

    if (recErr) {
      console.error('Error loading message recipients (athlete):', recErr)
      return NextResponse.json({ error: 'Error loading recipients' }, { status: 400 })
    }

    if (!recips || recips.length === 0) {
      if (searchParams.get('countOnly') === '1') {
        return NextResponse.json({ unreadMessageCount: 0 })
      }
      const { data: authorizedTeams } = teamIds.length > 0
        ? await dataClient.from('teams').select('id, name, code').in('id', teamIds)
        : { data: [] }
      return NextResponse.json({ messages: [], teams: authorizedTeams || [], read_state_scope: 'account_subject' })
    }

    let messageIds = [...new Set(recips.map(r => r.message_id))]
    if (idFilter) {
      if (!messageIds.includes(idFilter)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      messageIds = [idFilter]
    }

    // The shell only needs the badge count. Avoid loading message bodies and
    // full recipient/attachment metadata for that high-frequency request.
    if (searchParams.get('countOnly') === '1') {
      const { data: readRows } = await dataClient
        .from('message_reads')
        .select('message_id')
        .eq('auth_user_id', subject.account.authUserId)
        .eq('subject_profile_id', athleteProfileId)
        .in('message_id', messageIds)
      const readIds = new Set((readRows || []).map((row) => row.message_id))
      const unreadIds = new Set(messageIds.filter((messageId) => !readIds.has(messageId)))
      return NextResponse.json({ unreadMessageCount: unreadIds.size })
    }

    // Get messages
    let query = dataClient
      .from('messages')
      .select('id, subject, content, created_at, created_by')
      .in('id', messageIds)
      .order('created_at', { ascending: false })

    if (!view || view !== 'full') {
      query = query.limit(isNaN(limit) ? 10 : Math.max(1, limit))
    }

    const { data: msgs, error: msgErr } = await query
    if (msgErr) {
      console.error('Error loading messages (athlete):', msgErr)
      return NextResponse.json({ error: 'Error loading messages' }, { status: 400 })
    }

    const loadedMessageIds = (msgs || []).map((message) => message.id)
    const [{ data: readRows }, { data: messageTeams }] = await Promise.all([
      loadedMessageIds.length > 0
        ? dataClient
            .from('message_reads')
            .select('message_id, read_at')
            .eq('auth_user_id', subject.account.authUserId)
            .eq('subject_profile_id', athleteProfileId)
            .in('message_id', loadedMessageIds)
        : Promise.resolve({ data: [] }),
      teamIds.length > 0
        ? dataClient.from('teams').select('id, name, code').in('id', teamIds)
        : Promise.resolve({ data: [] }),
    ])
    const readByMessageId = new Map((readRows || []).map((row: any) => [row.message_id, { read_at: row.read_at }]))
    const teamsById = new Map((messageTeams || []).map((team: any) => [team.id, team]))
    const contractMessages = buildAthleteMessages(
      (msgs || []) as any,
      recips.filter((recipient) => loadedMessageIds.includes(recipient.message_id)),
      teamsById,
      readByMessageId,
      athleteProfileId,
    )

    if (!view || view !== 'full') {
      // === BATCH AGGREGATION FOR MINIMAL VIEW ===
      // Collect all creator IDs
      const creatorIds = [...new Set((msgs || []).filter(m => m.created_by).map(m => m.created_by))]

      // Single query to get all creators
      const { data: creators } = creatorIds.length > 0
        ? await adminClient
            .from('profiles')
            .select('id, first_name, last_name, role')
            .in('id', creatorIds)
        : { data: [] }

      const creatorsMap = new Map((creators || []).map(c => [c.id, c]))

      const minimal = contractMessages.map((m: any) => {
        const minimalMsg: any = { ...m }
        if (m.created_by && creatorsMap.has(m.created_by)) {
          const creator = creatorsMap.get(m.created_by)
          if (creator) {
            minimalMsg.created_by_profile = creator
            minimalMsg.from = `${creator.first_name || ''} ${creator.last_name || ''}`.trim()
          }
        }
        return minimalMsg
      })

      return NextResponse.json({ messages: minimal, teams: messageTeams || [], read_state_scope: 'account_subject' })
    }

    // === BATCH AGGREGATION FOR FULL VIEW ===

    // 1. Get all creators
    const fullCreatorIds = [...new Set((msgs || []).filter(m => m.created_by).map(m => m.created_by))]
    const { data: creators } = fullCreatorIds.length > 0
      ? await adminClient
          .from('profiles')
          .select('id, first_name, last_name, role')
          .in('id', fullCreatorIds)
      : { data: [] }
    const creatorsMap = new Map((creators || []).map(c => [c.id, c]))

    // 2. Get all recipients for all messages
    const fullMsgIds = (msgs || []).map(m => m.id)
    const { data: allRecipients } = fullMsgIds.length > 0
      ? await dataClient
          .from('message_recipients')
          .select('id, message_id, team_id, profile_id, is_read, read_at')
          .in('message_id', fullMsgIds)
      : { data: [] }

    // Per un accesso delegato dataClient è un admin client e quindi non applica
    // RLS sulle righe dei destinatari. Replica esplicitamente la visibilità
    // dell'atleta: squadra pertinente oppure solo il profilo atleta selezionato.
    const visibleRecipients = subject.delegated
      ? (allRecipients || []).filter((recipient) => (
          recipient.profile_id === athleteProfileId ||
          (recipient.team_id && teamIds.includes(recipient.team_id))
        ))
      : (allRecipients || [])

    // 3. Collect team and profile IDs from recipients
    const teamRecipientIds = [...new Set(visibleRecipients.filter(r => r.team_id).map(r => r.team_id))]
    // A subject may see that a message was sent directly to them, but never
    // receives the identity of unrelated direct recipients.
    const profileRecipientIds = [...new Set(
      visibleRecipients
        .filter(r => r.profile_id === athleteProfileId)
        .map(r => r.profile_id)
    )]

    // 4. Get all teams and profiles in batch
    const [{ data: teams }, { data: profiles }] = await Promise.all([
      teamRecipientIds.length > 0
        ? dataClient.from('teams').select('id, name').in('id', teamRecipientIds)
        : Promise.resolve({ data: [] }),
      profileRecipientIds.length > 0
        ? dataClient.from('profiles').select('id, first_name, last_name, email').in('id', profileRecipientIds)
        : Promise.resolve({ data: [] })
    ])

    const teamsMap = new Map((teams || []).map(t => [t.id, t]))
    const profilesMap = new Map((profiles || []).map(p => [p.id, p]))

    // 5. Create recipients map by message_id
    const recipientsByMessage = new Map<string, any[]>()
    for (const rr of visibleRecipients) {
      if (!recipientsByMessage.has(rr.message_id)) {
        recipientsByMessage.set(rr.message_id, [])
      }
      const readState = readByMessageId.get(rr.message_id)
      const item: any = {
        id: rr.id,
        is_read: Boolean(readState),
        read_at: readState?.read_at ?? null,
      }
      if (rr.team_id && teamsMap.has(rr.team_id)) {
        item.teams = teamsMap.get(rr.team_id)
      }
      if (rr.profile_id && profilesMap.has(rr.profile_id)) {
        item.profiles = profilesMap.get(rr.profile_id)
      }
      recipientsByMessage.get(rr.message_id)!.push(item)
    }

    // 6. Get all attachments for all messages
    const { data: allAttachments } = fullMsgIds.length > 0
      ? await adminClient
          .from('message_attachments')
          .select('id, message_id, file_path, file_name, mime_type, file_size')
          .in('message_id', fullMsgIds)
      : { data: [] }

    // 7. Return attachment metadata only. Signed URLs are generated by the
    // dedicated, subject-authorized endpoint when the user requests a file.
    const attachmentsByMessage = new Map<string, any[]>()
    if (allAttachments && allAttachments.length > 0) {
      for (const att of allAttachments) {
        if (!attachmentsByMessage.has(att.message_id)) {
          attachmentsByMessage.set(att.message_id, [])
        }
        attachmentsByMessage.get(att.message_id)!.push({
          id: att.id,
          file_name: att.file_name,
          mime_type: att.mime_type,
          file_size: att.file_size,
        })
      }
    }

    // 8. Enrich messages with aggregated data
    const enriched = (msgs || []).map((m: any) => {
      const em: any = { ...m }
      if (m.created_by && creatorsMap.has(m.created_by)) {
        em.created_by_profile = creatorsMap.get(m.created_by)
      }
      if (recipientsByMessage.has(m.id)) {
        em.message_recipients = recipientsByMessage.get(m.id)
      }
      if (attachmentsByMessage.has(m.id)) {
        em.attachments = attachmentsByMessage.get(m.id)
      }
      return em
    })
    const contractById = new Map(contractMessages.map((message) => [message.id, message]))
    const messages = enriched.map((message: any) => {
      const contract = contractById.get(message.id)
      return contract ? {
        ...message,
        dedupe_key: contract.dedupe_key,
        teams: contract.teams,
        team_ids: contract.team_ids,
        read_state: contract.read_state,
        is_read: contract.is_read,
      } : message
    })

    return NextResponse.json({ messages, teams: messageTeams || [], read_state_scope: 'account_subject' })
  } catch (error) {
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Athlete messages API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
