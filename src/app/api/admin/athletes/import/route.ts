import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { athleteImportSchema, type AthleteImportRow } from '@/lib/validation/profiles'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'

type ImportError = { row: number; membership_number: string; error: string }

function normalize(value: string | null | undefined) {
  return (value || '').trim().toLocaleLowerCase('it-IT')
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    await requireGlobalRole(supabase, 'admin')
    const parsed = athleteImportSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'File o parametri import non validi' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const { season_id: seasonId, rows, dry_run: dryRun = false } = parsed.data
    const { data: season } = await adminClient.from('seasons').select('id').eq('id', seasonId).maybeSingle()
    if (!season) return NextResponse.json({ error: 'Stagione non trovata' }, { status: 404 })

    const [{ data: activities }, { data: teams }] = await Promise.all([
      adminClient.from('activities').select('id, name, season_id').eq('season_id', seasonId),
      adminClient.from('teams').select('id, name, code, activity_id, activities!inner(season_id)').eq('activities.season_id', seasonId),
    ])

    const activityByName = new Map((activities || []).map((activity) => [normalize(activity.name), activity]))
    const teamByKey = new Map<string, (typeof teams extends (infer T)[] | null ? T : never)>()
    for (const team of teams || []) {
      teamByKey.set(normalize(team.code), team)
      teamByKey.set(normalize(team.name), team)
    }

    const result = { totalRows: rows.length, created: 0, updated: 0, skipped: 0, dryRun, errors: [] as ImportError[] }

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2
      const membershipNumber = row.membership_number.trim()
      let createdProfileId: string | null = null
      try {
        const { data: matches, error: lookupError } = await adminClient
          .from('athlete_profiles')
          .select('profile_id')
          .eq('membership_number', membershipNumber)

        if (lookupError) throw new Error('impossibile verificare il numero tessera')
        if ((matches || []).length > 1) throw new Error('numero tessera già associato a più persone')

        const activity = row.activity_name ? activityByName.get(normalize(row.activity_name)) : null
        if (row.activity_name && !activity) throw new Error(`attività non trovata nella stagione: ${row.activity_name}`)

        const team = row.team_code ? teamByKey.get(normalize(row.team_code)) : null
        if (row.team_code && !team) throw new Error(`squadra non trovata nella stagione: ${row.team_code}`)
        if (team && activity && team.activity_id !== activity.id) throw new Error('attività e squadra non sono coerenti')
        if (row.activity_name && !team) throw new Error('indicare una squadra quando si specifica l’attività')

        const existingProfileId = matches?.[0]?.profile_id
        if (dryRun) {
          if (existingProfileId) result.updated += 1
          else result.created += 1
          continue
        }

        let profileId = existingProfileId
        if (profileId) {
          const profileUpdate: Record<string, string | null> = {
            first_name: row.first_name,
            last_name: row.last_name,
          }
          if (row.email != null) profileUpdate.email = row.email
          if (row.phone != null) profileUpdate.phone = row.phone
          if (row.birth_date != null) profileUpdate.birth_date = row.birth_date
          const { error } = await adminClient.from('profiles').update(profileUpdate).eq('id', profileId)
          if (error) throw new Error('impossibile aggiornare l’anagrafica')

          const athleteUpdate: Record<string, string | null> = {}
          if (row.medical_certificate_expiry != null) athleteUpdate.medical_certificate_expiry = row.medical_certificate_expiry
          if (row.personal_notes != null) athleteUpdate.personal_notes = row.personal_notes
          if (Object.keys(athleteUpdate).length > 0) {
            const { error: athleteError } = await adminClient.from('athlete_profiles').update(athleteUpdate).eq('profile_id', profileId)
            if (athleteError) throw new Error('impossibile aggiornare i dati atleta')
          }
        } else {
          const { data: profile, error } = await adminClient.from('profiles').insert({
            first_name: row.first_name,
            last_name: row.last_name,
            email: row.email ?? null,
            phone: row.phone ?? null,
            birth_date: row.birth_date ?? null,
            role: null,
          }).select('id').single()
          if (error || !profile) throw new Error('impossibile creare l’anagrafica')
          profileId = profile.id
          createdProfileId = profile.id

          const { error: athleteError } = await adminClient.from('athlete_profiles').insert({
            profile_id: profileId,
            membership_number: membershipNumber,
            medical_certificate_expiry: row.medical_certificate_expiry ?? null,
            personal_notes: row.personal_notes ?? null,
          })
          if (athleteError) {
            await adminClient.from('profiles').delete().eq('id', profileId)
            throw new Error('impossibile creare i dati atleta')
          }
        }

        const { error: seasonError } = await adminClient.from('season_profiles').upsert({
          profile_id: profileId,
          season_id: seasonId,
          profile_type: 'athlete',
          source: 'admin_athlete_import',
        }, { onConflict: 'profile_id,season_id' })
        if (seasonError) throw new Error('impossibile collegare l’atleta alla stagione')

        if (team && profileId) {
          const { error: memberError } = await adminClient.from('team_members').upsert({
            profile_id: profileId,
            team_id: team.id,
            role: 'athlete',
            jersey_number: row.jersey_number ?? null,
          }, { onConflict: 'profile_id,team_id' })
          if (memberError) throw new Error('impossibile assegnare la squadra')
        }
        if (existingProfileId) result.updated += 1
        else result.created += 1
      } catch (error) {
        if (createdProfileId) await adminClient.from('profiles').delete().eq('id', createdProfileId)
        result.errors.push({
          row: rowNumber,
          membership_number: membershipNumber,
          error: error instanceof Error ? error.message : 'errore non previsto',
        })
      }
    }

    result.skipped = result.errors.length
    return NextResponse.json({ success: result.errors.length === 0, ...result })
  } catch (error) {
    if (error instanceof AccountContextError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Errore import massivo atleti:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
