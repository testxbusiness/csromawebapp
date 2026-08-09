import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'

export async function GET() {
  try {
    const supabase = await createClient()
    await requireGlobalRole(supabase, 'admin')
    const adminClient = createAdminClient()

    const [{ data: profiles, error: profilesError }, { data: coachProfiles, error: coachProfilesError }, { data: seasonProfiles, error: seasonProfilesError }] = await Promise.all([
      adminClient.from('profiles').select('id, first_name, last_name, role').order('first_name'),
      adminClient.from('coach_profiles').select('profile_id'),
      adminClient.from('season_profiles').select('profile_id, profile_type'),
    ])

    if (profilesError || coachProfilesError || seasonProfilesError) {
      console.error('Errore caricamento destinatari pagamenti:', profilesError || coachProfilesError || seasonProfilesError)
      return NextResponse.json({ error: 'Impossibile caricare i destinatari' }, { status: 500 })
    }

    const coachIds = new Set((coachProfiles ?? []).map((profile) => profile.profile_id))
    const typesByProfile = new Map<string, Set<string>>()
    for (const row of seasonProfiles ?? []) {
      if (!row.profile_type) continue
      const types = typesByProfile.get(row.profile_id) ?? new Set<string>()
      types.add(row.profile_type)
      typesByProfile.set(row.profile_id, types)
    }

    const payees = (profiles ?? [])
      .filter((profile) => coachIds.has(profile.id) || profile.role === 'coach' || typesByProfile.get(profile.id)?.has('coach') || typesByProfile.get(profile.id)?.has('staff'))
      .map((profile) => ({
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        type: coachIds.has(profile.id) || profile.role === 'coach' || typesByProfile.get(profile.id)?.has('coach') ? 'coach' : 'staff',
      }))

    return NextResponse.json({ payees })
  } catch (error) {
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Errore API destinatari pagamenti:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
