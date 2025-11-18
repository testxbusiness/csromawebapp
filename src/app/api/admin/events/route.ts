import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    const body = await request.json()
    
    const {
      title,
      description,
      start_date,
      end_date,
      location,
      gym_id,
      activity_id,
      event_type,
      event_kind,
      recurrence_rule, // { frequency: 'daily'|'weekly'|'monthly', interval?: number }
      recurrence_end_date,
      selected_teams
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

    // Helper per generare ricorrenze
    const buildOccurrences = (): { start_date: string; end_date: string }[] => {
      const freq = recurrence_rule?.frequency as 'daily'|'weekly'|'monthly'|undefined
      const interval = Math.max(1, Number(recurrence_rule?.interval || 1))
      if (!freq) return [{ start_date, end_date }]
      const occurrences: { start_date: string; end_date: string }[] = []
      let curStart = new Date(start_date)
      let curEnd = new Date(end_date)
      const until = new Date(recurrence_end_date || start_date)
      while (curStart <= until) {
        occurrences.push({ start_date: curStart.toISOString(), end_date: curEnd.toISOString() })
        // advance
        if (freq === 'daily') {
          curStart.setDate(curStart.getDate() + interval)
          curEnd.setDate(curEnd.getDate() + interval)
        } else if (freq === 'weekly') {
          curStart.setDate(curStart.getDate() + 7 * interval)
          curEnd.setDate(curEnd.getDate() + 7 * interval)
        } else if (freq === 'monthly') {
          curStart.setMonth(curStart.getMonth() + interval)
          curEnd.setMonth(curEnd.getMonth() + interval)
        } else {
          break
        }
      }
      return occurrences
    }

    // Crea evento singolo o ricorrente (serie di eventi)
    let createdEventIds: string[] = []

    if (event_type === 'recurring' && recurrence_rule && recurrence_end_date) {
      const occ = buildOccurrences()
      let rows = occ.map(o => ({
        // New schema fields
        title,
        description: description || null,
        start_date: o.start_date,
        end_date: o.end_date,
        location: location || null,
        gym_id: gym_id || null,
        activity_id: activity_id || null,
        event_type: 'recurring',
        event_kind: event_kind || 'training',
        recurrence_rule,
        recurrence_end_date,
        created_by: user.id,
        // Legacy required fields (DB requires NOT NULL)
        name: title,
        start_time: o.start_date,
        end_time: o.end_date,
        // Legacy column `kind` has a CHECK constraint; keep it to a valid legacy value
        kind: 'spot',
      }))
      let { data: inserted, error: bulkErr } = await adminClient
        .from('events')
        .insert(rows)
        .select('id')
      if ((bulkErr as any)?.code === '42703' || (bulkErr as any)?.message?.includes('event_kind')) {
        // Column missing → retry without event_kind
        rows = rows.map((r: any) => { const { event_kind, ...rest } = r; return rest })
        const retry = await adminClient.from('events').insert(rows).select('id')
        inserted = retry.data as any
        bulkErr = retry.error as any
      }
      if (bulkErr || !inserted) {
        console.error('Errore creazione eventi ricorrenti:', JSON.stringify(bulkErr, null, 2))
        const includeDebug = process.env.VERCEL_ENV !== 'production'
        return NextResponse.json({ 
          error: 'Errore creazione eventi ricorrenti',
          ...(includeDebug ? { debug: { code: (bulkErr as any)?.code, message: (bulkErr as any)?.message, details: (bulkErr as any)?.details, hint: (bulkErr as any)?.hint } } : {})
        }, { status: 400 })
      }
      createdEventIds = inserted.map(r => r.id)
      // Set parent_event_id to the first created id for all occurrences
      if (createdEventIds.length > 0) {
        const parentId = createdEventIds[0]
        const { error: parentErr } = await adminClient
          .from('events')
          .update({ parent_event_id: parentId })
          .in('id', createdEventIds)
        if (parentErr) {
          console.warn('Impostazione parent_event_id fallita:', parentErr)
        }
      }
    } else {
      let { data: event, error: eventError } = await adminClient
        .from('events')
        .insert({
          // New schema fields
          title,
          description: description || null,
          start_date,
          end_date,
          location: location || null,
          gym_id: gym_id || null,
          activity_id: activity_id || null,
          event_type: event_type || 'one_time',
          event_kind: event_kind || 'training',
          requires_confirmation: !!body.requires_confirmation,
          confirmation_deadline: body.requires_confirmation && body.confirmation_deadline ? body.confirmation_deadline : null,
          created_by: user.id,
          // Legacy required fields
          name: title,
          start_time: start_date,
          end_time: end_date,
          kind: 'spot',
        })
        .select('id')
        .single()
      if ((eventError as any)?.code === '42703' || (eventError as any)?.message?.includes('event_kind')) {
        // Retry without event_kind
        const retry = await adminClient
          .from('events')
          .insert({
            // New schema fields (without event_kind)
            title,
            description: description || null,
            start_date,
            end_date,
            location: location || null,
            gym_id: gym_id || null,
            activity_id: activity_id || null,
            event_type: event_type || 'one_time',
            created_by: user.id,
            // Legacy required fields
            name: title,
            start_time: start_date,
            end_time: end_date,
            kind: 'spot',
          })
          .select('id')
          .single()
        event = retry.data as any
        eventError = retry.error as any
      }
      if (eventError || !event) {
        console.error('Errore creazione evento:', JSON.stringify(eventError, null, 2))
        const includeDebug = process.env.VERCEL_ENV !== 'production'
        return NextResponse.json({ 
          error: 'Errore creazione evento',
          ...(includeDebug ? { debug: { code: (eventError as any)?.code, message: (eventError as any)?.message, details: (eventError as any)?.details, hint: (eventError as any)?.hint } } : {})
        }, { status: 400 })
      }
      createdEventIds = [event.id]
    }

    // Gestisci assegnazione squadre se specificate per tutti gli eventi creati
    if (selected_teams && selected_teams.length > 0 && createdEventIds.length > 0) {
      const eventTeams = createdEventIds.flatMap((eid: string) => 
        selected_teams.map((team_id: string) => ({ event_id: eid, team_id }))
      )
      const { error: teamError } = await adminClient
        .from('event_teams')
        .insert(eventTeams)
      if (teamError) {
        console.error('Errore creazione event_teams:', JSON.stringify(teamError, null, 2))
      }
    }

    return NextResponse.json({ success: true, event_ids: createdEventIds, message: 'Evento creato con successo' })

  } catch (error) {
    console.error('Errore API creazione evento:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('team_id')
    const from = searchParams.get('from') // ISO string
    const to = searchParams.get('to') // ISO string
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50'), 1), 200) // Max 200
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0)

    // Verifica che l'utente corrente sia admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (user as any)?.user_metadata?.role
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Se filtriamo per squadra, recupera gli event_ids prima con batching
    let eventIds: string[] | null = null
    if (teamId) {
      const { data: links, error: linkErr } = await adminClient
        .from('event_teams')
        .select('event_id')
        .eq('team_id', teamId)
      if (linkErr) {
        return NextResponse.json({ error: linkErr.message }, { status: 400 })
      }
      eventIds = Array.from(new Set((links || []).map(l => l.event_id)))
      if (eventIds.length === 0) {
        return NextResponse.json({ events: [], total: 0 })
      }
    }

    // Ottieni gli eventi base con paginazione
    let query = adminClient
      .from('events')
      .select('*', { count: 'exact' })

    if (eventIds) {
      // Dividi in batch per evitare URL troppo lunghi
      if (eventIds.length > 100) {
        const batchedEvents = []
        for (let i = 0; i < eventIds.length; i += 100) {
          const batch = eventIds.slice(i, i + 100)
          const { data } = await adminClient
            .from('events')
            .select('*')
            .in('id', batch)
          batchedEvents.push(...(data || []))
        }
        // Ordina e applica paginazione manualmente
        batchedEvents.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
        let eventsData = batchedEvents.slice(offset, offset + limit)
        return NextResponse.json({
          events: eventsData,
          total: batchedEvents.length,
          limit,
          offset
        })
      }
      query = query.in('id', eventIds)
    }

    if (from) query = query.gte('start_date', from)
    if (to) query = query.lte('start_date', to)

    const { data: eventsData, error, count } = await query
      .order('start_date', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Errore query eventi base:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Se non ci sono eventi, ritorna array vuoto
    if (!eventsData || eventsData.length === 0) {
      return NextResponse.json({ events: [], total: count || 0, limit, offset })
    }

    // === AGGREGAZIONE BATCH QUERIES ANZICHÉ N+1 ===

    // Raccogli tutti gli IDs unici da queryare
    const gymIds = [...new Set(eventsData.filter(e => e.gym_id).map(e => e.gym_id))]
    const activityIds = [...new Set(eventsData.filter(e => e.activity_id).map(e => e.activity_id))]
    const creatorIds = [...new Set(eventsData.filter(e => e.created_by).map(e => e.created_by))]
    const eventIdsList = eventsData.map(e => e.id)

    // Query aggregate (massimo 5 query invece di 500+)
    const [gymsResult, activitiesResult, creatorsResult, eventTeamsResult] = await Promise.all([
      // Query 1: Tutte le palestre
      gymIds.length > 0 ? adminClient
        .from('gyms')
        .select('id, name, address, city')
        .in('id', gymIds)
        : Promise.resolve({ data: [] }),
      // Query 2: Tutte le attività
      activityIds.length > 0 ? adminClient
        .from('activities')
        .select('id, name')
        .in('id', activityIds)
        : Promise.resolve({ data: [] }),
      // Query 3: Tutti i creators
      creatorIds.length > 0 ? adminClient
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', creatorIds)
        : Promise.resolve({ data: [] }),
      // Query 4: Tutte le relazioni event_teams
      eventIdsList.length > 0 ? adminClient
        .from('event_teams')
        .select('event_id, team_id')
        .in('event_id', eventIdsList)
        : Promise.resolve({ data: [] })
    ])

    // Crea mappe per lookup O(1)
    const gymsMap = new Map((gymsResult.data || []).map(g => [g.id, g]))
    const activitiesMap = new Map((activitiesResult.data || []).map(a => [a.id, a]))
    const creatorsMap = new Map((creatorsResult.data || []).map(p => [p.id, p]))

    // Query 5: Tutte le squadre associate agli event_teams
    const teamIds = [...new Set((eventTeamsResult.data || []).map(et => et.team_id))]
    const teamsResult = teamIds.length > 0
      ? await adminClient
          .from('teams')
          .select('id, name')
          .in('id', teamIds)
      : { data: [] }

    const teamsMap = new Map((teamsResult.data || []).map(t => [t.id, t]))

    // Crea mappa event_teams per lookup
    const eventTeamsMap = new Map<string, any[]>()
    for (const et of (eventTeamsResult.data || [])) {
      if (!eventTeamsMap.has(et.event_id)) {
        eventTeamsMap.set(et.event_id, [])
      }
      eventTeamsMap.get(et.event_id)!.push(et)
    }

    // Enrichisci gli eventi in O(n) instead di O(n*m)
    const enrichedEvents = eventsData.map(event => ({
      ...event,
      gyms: event.gym_id ? gymsMap.get(event.gym_id) || null : null,
      activities: event.activity_id ? activitiesMap.get(event.activity_id) || null : null,
      created_by_profile: event.created_by ? creatorsMap.get(event.created_by) || null : null,
      event_teams: (eventTeamsMap.get(event.id) || []).map(et => ({
        teams: teamsMap.get(et.team_id)
      }))
    }))

    return NextResponse.json({
      events: enrichedEvents,
      total: count || 0,
      limit,
      offset
    })

  } catch (error) {
    console.error('Errore API lista eventi:', error)
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
      title,
      description,
      start_date,
      end_date,
      location,
      gym_id,
      activity_id,
      event_type,
      event_kind,
      selected_teams
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
      return NextResponse.json({ error: 'ID evento richiesto' }, { status: 400 })
    }

    // Aggiorna l'evento (retry senza event_kind se colonna assente)
    let updateRes = await adminClient
      .from('events')
      .update({
        // New schema fields
        title,
        description: description || null,
        start_date,
        end_date,
        location: location || null,
        gym_id: gym_id || null,
        activity_id: activity_id || null,
        event_type,
        event_kind: event_kind || 'training',
        // Legacy fields kept in sync
        name: title,
        start_time: start_date,
        end_time: end_date,
        kind: 'spot',
      })
      .eq('id', id)

    if ((updateRes as any)?.error && (((updateRes as any).error.code === '42703') || ((updateRes as any).error.message || '').includes('event_kind'))) {
      updateRes = await adminClient
        .from('events')
        .update({
          // New schema fields (without event_kind)
          title,
          description: description || null,
          start_date,
          end_date,
          location: location || null,
          gym_id: gym_id || null,
          activity_id: activity_id || null,
          event_type,
          // Legacy fields kept in sync
          name: title,
          start_time: start_date,
          end_time: end_date,
          kind: 'spot',
        })
        .eq('id', id)
    }

    if ((updateRes as any)?.error) {
      console.error('Errore aggiornamento evento:', JSON.stringify((updateRes as any).error, null, 2))
      const includeDebug = process.env.VERCEL_ENV !== 'production'
      return NextResponse.json({ 
        error: 'Errore aggiornamento evento',
        ...(includeDebug ? { debug: { code: (updateRes as any).error?.code, message: (updateRes as any).error?.message, details: (updateRes as any).error?.details, hint: (updateRes as any).error?.hint } } : {})
      }, { status: 400 })
    }

    // Gestisci assegnazione squadre
    if (selected_teams) {
      // Rimuovi assegnazioni esistenti
      await adminClient
        .from('event_teams')
        .delete()
        .eq('event_id', id)

      // Aggiungi nuove assegnazioni
      if (selected_teams.length > 0) {
        const eventTeams = selected_teams.map((team_id: string) => ({
          event_id: id,
          team_id
        }))

        const { error: teamError } = await adminClient
          .from('event_teams')
          .insert(eventTeams)

        if (teamError) {
          console.error('Errore assegnazione squadre evento:', teamError)
        }
      }
    }

    // Allow update of RSVP flags too
    if (typeof (body as any).requires_confirmation !== 'undefined' || typeof (body as any).confirmation_deadline !== 'undefined') {
      await adminClient
        .from('events')
        .update({
          requires_confirmation: !!(body as any).requires_confirmation,
          confirmation_deadline: (body as any).requires_confirmation && (body as any).confirmation_deadline ? (body as any).confirmation_deadline : null,
        })
        .eq('id', id)
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Evento aggiornato con successo'
    })

  } catch (error) {
    console.error('Errore API aggiornamento evento:', error)
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
    const eventId = searchParams.get('id')
    const scope = searchParams.get('scope') || 'one'
    
    if (!eventId) {
      return NextResponse.json({ error: 'ID evento richiesto' }, { status: 400 })
    }

    if (scope === 'series') {
      // Recupera parent_event_id
      const { data: evt } = await adminClient
        .from('events')
        .select('id, parent_event_id')
        .eq('id', eventId)
        .single()

      const seriesId = evt?.parent_event_id || eventId

      // Trova tutti gli eventi della serie
      const { data: seriesEvents } = await adminClient
        .from('events')
        .select('id')
        .or(`id.eq.${seriesId},parent_event_id.eq.${seriesId}`)

      const ids = (seriesEvents || []).map(e => e.id)

      if (ids.length > 0) {
        // Elimina associazioni per tutti
        await adminClient
          .from('event_teams')
          .delete()
          .in('event_id', ids)

        // Elimina eventi
        const { error: delErr } = await adminClient
          .from('events')
          .delete()
          .in('id', ids)
        if (delErr) {
          console.error('Errore eliminazione serie eventi:', delErr)
          return NextResponse.json({ error: 'Errore eliminazione serie' }, { status: 400 })
        }
      }
    } else {
      // 1. Elimina le assegnazioni squadre di un singolo evento
      await adminClient
        .from('event_teams')
        .delete()
        .eq('event_id', eventId)

      // 2. Elimina l'evento singolo
      const { error: eventError } = await adminClient
        .from('events')
        .delete()
        .eq('id', eventId)

      if (eventError) {
        console.error('Errore eliminazione evento:', eventError)
        return NextResponse.json({ error: 'Errore eliminazione evento' }, { status: 400 })
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: scope === 'series' ? 'Serie eventi eliminata con successo' : 'Evento eliminato con successo'
    })

  } catch (error) {
    console.error('Errore API eliminazione evento:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
