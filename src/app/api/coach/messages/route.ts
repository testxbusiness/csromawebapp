import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const view = searchParams.get('view') // 'full' to return full list with enrichment
    const idFilter = searchParams.get('id') || undefined
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 3
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is a coach
    const role = (user as any)?.user_metadata?.role
    if (role !== 'coach') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get coach's teams
    const { data: coachTeams, error: teamsError } = await supabase
      .from('team_coaches')
      .select('team_id')
      .eq('coach_id', user.id)

    if (teamsError) {
      console.error('Error loading coach teams:', teamsError)
      return NextResponse.json({ error: 'Error loading teams' }, { status: 400 })
    }

    const teamIds = (coachTeams || []).map(team => team.team_id)

    // Get message IDs for coach's teams or direct-to-coach
    // Build OR filter only with available clauses (avoid empty IN())
    const orClauses = [] as string[]
    if (teamIds.length > 0) orClauses.push(`team_id.in.(${teamIds.join(',')})`)
    orClauses.push(`profile_id.eq.${user.id}`)

    const { data: messageRecipients, error: recipientsError } = await supabase
      .from('message_recipients')
      .select('message_id')
      .or(orClauses.join(','))
      .order('created_at', { ascending: false })

    if (recipientsError) {
      console.error('Error loading message recipients:', recipientsError)
      return NextResponse.json({ error: 'Error loading message recipients' }, { status: 400 })
    }

    if (!messageRecipients || messageRecipients.length === 0) {
      return NextResponse.json({ messages: [] })
    }

    let messageIds = [...new Set(messageRecipients.map(mr => mr.message_id))]
    if (idFilter) {
      // Keep only if accessible
      if (!messageIds.includes(idFilter)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      messageIds = [idFilter]
    }

    // Get the actual messages
    let query = supabase
      .from('messages')
      .select('id, subject, content, created_at, created_by')
      .in('id', messageIds)
      .order('created_at', { ascending: false })

    if (!view || view !== 'full') {
      query = query.limit(isNaN(limit) ? 3 : Math.max(1, limit))
    }

    const { data: messages, error: messagesError } = await query

    if (messagesError) {
      console.error('Error loading messages:', messagesError)
      return NextResponse.json({ error: 'Error loading messages' }, { status: 400 })
    }

    // If not full view, return minimal payload
    if (!view || view !== 'full') {
      return NextResponse.json({ 
        messages: messages || [],
        team_count: teamIds.length
      })
    }

    // Enrich messages: creator profile and visible recipients
    const enriched = [] as any[]
    for (const msg of messages || []) {
      const enrichedMsg: any = { ...msg }

      if (msg.created_by) {
        const { data: creator } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', msg.created_by as any)
          .maybeSingle()
        if (creator) enrichedMsg.created_by_profile = creator
      }

      const { data: recipients } = await supabase
        .from('message_recipients')
        .select('id, is_read, read_at, team_id, profile_id')
        .eq('message_id', msg.id)

      if (recipients && recipients.length > 0) {
        enrichedMsg.message_recipients = []
        for (const r of recipients) {
          const rec: any = { id: r.id, is_read: r.is_read, read_at: r.read_at }
          if (r.team_id) {
            const { data: t } = await supabase
              .from('teams')
              .select('id, name')
              .eq('id', r.team_id)
              .maybeSingle()
            if (t) rec.teams = t
          }
          if (r.profile_id) {
            const { data: p } = await supabase
              .from('profiles')
              .select('id, first_name, last_name, email')
              .eq('id', r.profile_id)
              .maybeSingle()
            if (p) rec.profiles = p
          }
          enrichedMsg.message_recipients.push(rec)
        }
      }

      enriched.push(enrichedMsg)
    }

    return NextResponse.json({ messages: enriched, team_count: teamIds.length })

  } catch (error) {
    console.error('Error in coach messages API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    const body = await request.json()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (user as any)?.user_metadata?.role
    if (role !== 'coach') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { subject, content, attachment_url, selected_teams } = body || {}
    if (!subject || !content) {
      return NextResponse.json({ error: 'Dati messaggio incompleti' }, { status: 400 })
    }

    // Get coach teams to validate recipients
    const { data: coachTeams } = await supabase
      .from('team_coaches')
      .select('team_id')
      .eq('coach_id', user.id)

    const allowedTeamIds = new Set((coachTeams || []).map(t => t.team_id))
    const teamsToAssign: string[] = (selected_teams || []).filter((id: string) => allowedTeamIds.has(id))

    // Create message (RLS: created_by must be user.id)
    const { data: created, error: createErr } = await supabase
      .from('messages')
      .insert({ subject, content, attachment_url: attachment_url || null, created_by: user.id })
      .select('id')
      .single()

    if (createErr || !created) {
      console.error('Coach create message error:', createErr)
      return NextResponse.json({ error: 'Errore creazione messaggio' }, { status: 400 })
    }

    if (teamsToAssign.length > 0) {
      const recipients = teamsToAssign.map(team_id => ({ message_id: created.id, team_id, is_read: false }))
      const { error: recErr } = await adminClient.from('message_recipients').insert(recipients)
      if (recErr) {
        console.error('Coach assign recipients error:', recErr)
        return NextResponse.json({ error: 'Errore assegnazione destinatari' }, { status: 400 })
      }
    }

    return NextResponse.json({ success: true, message_id: created.id })

  } catch (error) {
    console.error('Error in coach messages POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    const body = await request.json()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (user as any)?.user_metadata?.role
    if (role !== 'coach') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id, subject, content, attachment_url, selected_teams } = body || {}
    if (!id) return NextResponse.json({ error: 'ID messaggio richiesto' }, { status: 400 })

    // Ensure the message belongs to the coach
    const { data: ownedMsg } = await supabase
      .from('messages')
      .select('id, created_by')
      .eq('id', id)
      .eq('created_by', user.id)
      .maybeSingle()

    if (!ownedMsg) {
      return NextResponse.json({ error: 'Non autorizzato a modificare questo messaggio' }, { status: 403 })
    }

    // Update message
    const { error: updErr } = await supabase
      .from('messages')
      .update({ subject, content, attachment_url: attachment_url || null })
      .eq('id', id)

    if (updErr) {
      console.error('Coach update message error:', updErr)
      return NextResponse.json({ error: 'Errore aggiornamento messaggio' }, { status: 400 })
    }

    // Replace recipients using admin client (after ownership check)
    await adminClient.from('message_recipients').delete().eq('message_id', id)

    if (selected_teams && selected_teams.length > 0) {
      const recipients = (selected_teams as string[]).map(team_id => ({ message_id: id, team_id, is_read: false }))
      const { error: recErr } = await adminClient.from('message_recipients').insert(recipients)
      if (recErr) console.error('Coach reassign recipients error:', recErr)
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in coach messages PUT:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (user as any)?.user_metadata?.role
    if (role !== 'coach') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID messaggio richiesto' }, { status: 400 })

    // Delete message (will cascade to recipients); RLS restricts to own messages
    const { error: delErr } = await supabase.from('messages').delete().eq('id', id)
    if (delErr) {
      console.error('Coach delete message error:', delErr)
      return NextResponse.json({ error: 'Errore eliminazione messaggio' }, { status: 400 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in coach messages DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
