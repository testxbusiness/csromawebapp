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
      return NextResponse.json({ messages: msgs || [] })
    }

    // Enrich with creator and visible recipients
    const enriched: any[] = []
    for (const m of msgs || []) {
      const em: any = { ...m }
      if (m.created_by) {
        // Use admin client to bypass profiles RLS (athletes cannot read other profiles)
        const { data: creator } = await adminClient
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', m.created_by as any)
          .maybeSingle()
        if (creator) em.created_by_profile = creator
      }
      // Only recipients visible via RLS (own profile or own teams)
      const { data: r } = await supabase
        .from('message_recipients')
        .select('id, team_id, profile_id, is_read, read_at')
        .eq('message_id', m.id)
      if (r && r.length) {
        em.message_recipients = []
        for (const rr of r) {
          const item: any = { id: rr.id, is_read: rr.is_read, read_at: rr.read_at }
          if (rr.team_id) {
            const { data: t } = await supabase
              .from('teams')
              .select('id, name')
              .eq('id', rr.team_id)
              .maybeSingle()
            if (t) item.teams = t
          }
          if (rr.profile_id) {
            const { data: p } = await supabase
              .from('profiles')
              .select('id, first_name, last_name, email')
              .eq('id', rr.profile_id)
              .maybeSingle()
            if (p) item.profiles = p
          }
          em.message_recipients.push(item)
        }
      }
      enriched.push(em)
    }

    return NextResponse.json({ messages: enriched })
  } catch (error) {
    console.error('Athlete messages API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
