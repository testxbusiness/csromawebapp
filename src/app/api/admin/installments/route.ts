import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/admin/installments?team_id=&profile_id=&status=&from=&to=&limit=&offset=
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()
    const { searchParams } = new URL(request.url)

    // Auth: only admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (user as any)?.user_metadata?.role
    if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const teamId = searchParams.get('team_id') || undefined
    const profileId = searchParams.get('profile_id') || undefined
    const status = searchParams.get('status') || undefined // not_due|due_soon|overdue|paid|all
    const from = searchParams.get('from') || undefined // due_date >= from (YYYY-MM-DD)
    const to = searchParams.get('to') || undefined // due_date <= to
    const limit = parseInt(searchParams.get('limit') || '200', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Step 1: base installments filters
    let q = admin.from('fee_installments')
      .select('id, membership_fee_id, profile_id, installment_number, due_date, amount, status, paid_at')
      .order('due_date', { ascending: true })

    if (profileId) q = q.eq('profile_id', profileId)
    if (status && status !== 'all') q = q.eq('status', status)
    if (from) q = q.gte('due_date', from)
    if (to) q = q.lte('due_date', to)

    const { data: baseRows, error: baseErr } = await q
    if (baseErr) return NextResponse.json({ error: baseErr.message }, { status: 400 })

    let rows = baseRows || []

    // Step 2: filter by team if requested (via membership_fees)
    let feeMap = new Map<string, any>()
    if (teamId) {
      const feeIds = Array.from(new Set(rows.map(r => r.membership_fee_id)))
      if (feeIds.length === 0) return NextResponse.json({ items: [], total: 0 })
      const { data: fees } = await admin
        .from('membership_fees')
        .select('id, name, team_id')
        .in('id', feeIds)
      const allowed = new Set((fees || []).filter(f => f.team_id === teamId).map(f => f.id))
      rows = rows.filter(r => allowed.has(r.membership_fee_id))
      feeMap = new Map((fees || []).map(f => [f.id, f]))
    }

    // Step 3: enrichment (profiles, membership_fees, teams)
    const profileIds = Array.from(new Set(rows.map(r => r.profile_id)))
    const mfIds = Array.from(new Set(rows.map(r => r.membership_fee_id)))

    if (mfIds.length > 0 && feeMap.size === 0) {
      const { data: fees } = await admin
        .from('membership_fees')
        .select('id, name, team_id')
        .in('id', mfIds)
      feeMap = new Map((fees || []).map(f => [f.id, f]))
    }

    let teamMap = new Map<string, any>()
    if (feeMap.size > 0) {
      const teamIds = Array.from(new Set(Array.from(feeMap.values()).map((f: any) => f.team_id).filter(Boolean)))
      if (teamIds.length > 0) {
        const { data: teams } = await admin
          .from('teams')
          .select('id, name, code')
          .in('id', teamIds)
        teamMap = new Map((teams || []).map(t => [t.id, t]))
      }
    }

    let profileMap = new Map<string, any>()
    if (profileIds.length > 0) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', profileIds)
      profileMap = new Map((profiles || []).map(p => [p.id, p]))
    }

    // Step 4: slicing/pagination and shaping
    const total = rows.length
    const sliced = rows.slice(offset, offset + limit)
    const items = sliced.map(r => {
      const fee = feeMap.get(r.membership_fee_id)
      const team = fee ? teamMap.get(fee.team_id) : undefined
      const prof = profileMap.get(r.profile_id)
      return {
        ...r,
        profile: prof ? { id: prof.id, first_name: prof.first_name, last_name: prof.last_name } : null,
        membership_fee: fee ? { id: fee.id, name: fee.name } : null,
        team: team ? { id: team.id, name: team.name, code: team.code } : null,
      }
    })

    return NextResponse.json({ items, total })
  } catch (e) {
    console.error('Admin installments GET error:', e)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

