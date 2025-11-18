import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    const { searchParams } = new URL(request.url)
    const view = searchParams.get('view') // 'full' for enriched payload
    const idFilter = searchParams.get('id') || undefined
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 10

    // Auth + role
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const role = (user as any)?.user_metadata?.role
    if (role !== 'athlete') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get athlete team IDs
    const { data: memberships, error: tmErr } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('profile_id', user.id)

    if (tmErr) {
      console.error('Error loading athlete team memberships:', tmErr)
      return NextResponse.json({ error: 'Error loading memberships' }, { status: 400 })
    }

    const teamIds = [...new Set((memberships || []).map(m => m.team_id).filter(Boolean))]

    // Get message IDs from recipients (direct or team)
    const orClauses: string[] = []
    orClauses.push(`profile_id.eq.${user.id}`)
    if (teamIds.length > 0) orClauses.push(`team_id.in.(${teamIds.join(',')})`)

    const { data: recips, error: recErr } = await supabase
      .from('message_recipients')
      .select('message_id, team_id, profile_id')
      .or(orClauses.join(','))
      .order('created_at', { ascending: false })

    if (recErr) {
      console.error('Error loading message recipients (athlete):', recErr)
      return NextResponse.json({ error: 'Error loading recipients' }, { status: 400 })
    }

    if (!recips || recips.length === 0) {
      return NextResponse.json({ messages: [] })
    }

    let messageIds = [...new Set(recips.map(r => r.message_id))]
    if (idFilter) {
      if (!messageIds.includes(idFilter)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      messageIds = [idFilter]
    }

    // Get messages
    let query = supabase
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

    if (!view || view !== 'full') {
      // === BATCH AGGREGATION FOR MINIMAL VIEW ===
      // Collect all creator IDs
      const creatorIds = [...new Set((msgs || []).filter(m => m.created_by).map(m => m.created_by))]

      // Single query to get all creators
      const { data: creators } = creatorIds.length > 0
        ? await adminClient
            .from('profiles')
            .select('id, first_name, last_name')
            .in('id', creatorIds)
        : { data: [] }

      const creatorsMap = new Map((creators || []).map(c => [c.id, c]))

      const minimal = (msgs || []).map((m: any) => {
        const minimalMsg: any = { ...m }
        if (m.created_by && creatorsMap.has(m.created_by)) {
          const creator = creatorsMap.get(m.created_by)
          minimalMsg.created_by_profile = creator
          minimalMsg.from = `${creator.first_name || ''} ${creator.last_name || ''}`.trim()
        }
        return minimalMsg
      })

      return NextResponse.json({ messages: minimal })
    }

    // === BATCH AGGREGATION FOR FULL VIEW ===

    // 1. Get all creators
    const creatorIds = [...new Set((msgs || []).filter(m => m.created_by).map(m => m.created_by))]
    const { data: creators } = creatorIds.length > 0
      ? await adminClient
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', creatorIds)
      : { data: [] }
    const creatorsMap = new Map((creators || []).map(c => [c.id, c]))

    // 2. Get all recipients for all messages
    const msgIds = (msgs || []).map(m => m.id)
    const { data: allRecipients } = msgIds.length > 0
      ? await supabase
          .from('message_recipients')
          .select('id, message_id, team_id, profile_id, is_read, read_at')
          .in('message_id', msgIds)
      : { data: [] }

    // 3. Collect team and profile IDs from recipients
    const teamIds = [...new Set((allRecipients || []).filter(r => r.team_id).map(r => r.team_id))]
    const profileIds = [...new Set((allRecipients || []).filter(r => r.profile_id).map(r => r.profile_id))]

    // 4. Get all teams and profiles in batch
    const [{ data: teams }, { data: profiles }] = await Promise.all([
      teamIds.length > 0
        ? supabase.from('teams').select('id, name').in('id', teamIds)
        : Promise.resolve({ data: [] }),
      profileIds.length > 0
        ? supabase.from('profiles').select('id, first_name, last_name, email').in('id', profileIds)
        : Promise.resolve({ data: [] })
    ])

    const teamsMap = new Map((teams || []).map(t => [t.id, t]))
    const profilesMap = new Map((profiles || []).map(p => [p.id, p]))

    // 5. Create recipients map by message_id
    const recipientsByMessage = new Map<string, any[]>()
    for (const rr of (allRecipients || [])) {
      if (!recipientsByMessage.has(rr.message_id)) {
        recipientsByMessage.set(rr.message_id, [])
      }
      const item: any = { id: rr.id, is_read: rr.is_read, read_at: rr.read_at }
      if (rr.team_id && teamsMap.has(rr.team_id)) {
        item.teams = teamsMap.get(rr.team_id)
      }
      if (rr.profile_id && profilesMap.has(rr.profile_id)) {
        item.profiles = profilesMap.get(rr.profile_id)
      }
      recipientsByMessage.get(rr.message_id)!.push(item)
    }

    // 6. Get all attachments for all messages
    const { data: allAttachments } = msgIds.length > 0
      ? await adminClient
          .from('message_attachments')
          .select('id, message_id, file_path, file_name, mime_type, file_size')
          .in('message_id', msgIds)
      : { data: [] }

    // 7. Generate signed URLs in batch
    const attachmentsByMessage = new Map<string, any[]>()
    if (allAttachments && allAttachments.length > 0) {
      const signedUrlPromises = (allAttachments || []).map(a =>
        adminClient
          // @ts-ignore
          .storage.from('message-attachments')
          .createSignedUrl(a.file_path, 3600)
          .then(({ data: signed }) => ({
            ...a,
            download_url: signed?.signedUrl || null
          }))
          .catch(err => {
            console.error(`Error signing URL for ${a.file_path}:`, err)
            return { ...a, download_url: null }
          })
      )

      const signedAttachments = await Promise.all(signedUrlPromises)

      for (const att of signedAttachments) {
        if (!attachmentsByMessage.has(att.message_id)) {
          attachmentsByMessage.set(att.message_id, [])
        }
        attachmentsByMessage.get(att.message_id)!.push({
          id: att.id,
          file_name: att.file_name,
          mime_type: att.mime_type,
          file_size: att.file_size,
          download_url: att.download_url
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

    return NextResponse.json({ messages: enriched })
  } catch (error) {
    console.error('Athlete messages API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
