import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { noStoreJson } from '@/server/http/no-store'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireSubjectAthleteContext } from '@/server/auth/require-subject-profile'
import { buildAthleteProfileContract } from '@/server/profile/athlete-profile'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const subject = await requireSubjectAthleteContext(supabase, searchParams.get('subjectProfileId'))
    const client = subject.dataClient

    const [{ data: profile, error: profileError }, { data: athleteProfile, error: athleteError }, { data: memberships, error: membershipsError }] = await Promise.all([
      client.from('profiles').select('id, first_name, last_name, email, phone, birth_date').eq('id', subject.profileId).maybeSingle(),
      client.from('athlete_profiles').select('profile_id, membership_number, medical_certificate_expiry').eq('profile_id', subject.profileId).maybeSingle(),
      client.from('team_members').select('id, team_id, jersey_number').eq('profile_id', subject.profileId),
    ])

    if (profileError || athleteError || membershipsError) {
      console.error('Errore caricamento profilo atleta:', profileError || athleteError || membershipsError)
      return noStoreJson({ error: 'Impossibile caricare il profilo atleta' }, 500)
    }
    if (!profile) return noStoreJson({ error: 'Profilo atleta non trovato' }, 404)

    const safeMemberships = memberships ?? []
    const teamIds = [...new Set(safeMemberships.map((membership) => membership.team_id))]
    const { data: teams, error: teamsError } = teamIds.length
      ? await client.from('teams').select('id, name, code, activity_id').in('id', teamIds)
      : { data: [], error: null }
    if (teamsError) {
      console.error('Errore caricamento squadre profilo atleta:', teamsError)
      return noStoreJson({ error: 'Impossibile caricare le squadre del profilo' }, 500)
    }

    const safeTeams = teams ?? []
    const activityIds = [...new Set(safeTeams.map((team) => team.activity_id))]
    const { data: activities, error: activitiesError } = activityIds.length
      ? await client.from('activities').select('id, name').in('id', activityIds)
      : { data: [], error: null }
    if (activitiesError) {
      console.error('Errore caricamento attività profilo atleta:', activitiesError)
      return noStoreJson({ error: 'Impossibile caricare le attività del profilo' }, 500)
    }

    const documents = subject.permissions.view_documents
      ? await Promise.all([
          client.from('documents')
            .select('id, title, status, file_name, created_at')
            .eq('target_user_id', subject.profileId)
            .in('status', ['generated', 'sent']),
          safeTeams.length
            ? client.from('documents')
                .select('id, title, status, file_name, created_at')
                .in('target_team_id', safeTeams.map((team) => team.id))
                .in('status', ['generated', 'sent'])
            : Promise.resolve({ data: [], error: null }),
        ]).then(([personal, team]) => {
          const rows = [...(personal.data ?? []), ...(team.data ?? [])]
          return {
            rows: rows.filter((document, index, all) => all.findIndex((candidate) => candidate.id === document.id) === index),
            error: personal.error ?? team.error,
          }
        })
      : { rows: [], error: null }
    if (documents.error) {
      console.error('Errore caricamento documenti profilo atleta:', documents.error)
      return noStoreJson({ error: 'Impossibile caricare i documenti del profilo' }, 500)
    }

    return noStoreJson(buildAthleteProfileContract({
      account: subject.account,
      subject,
      profile,
      athleteProfile,
      memberships: safeMemberships,
      teams: new Map((safeTeams).map((team) => [team.id, team])),
      activities: new Map((activities ?? []).map((activity) => [activity.id, activity])),
      documents: documents.rows,
    }))
  } catch (error) {
    if (error instanceof AccountContextError) return noStoreJson({ error: error.message }, error.status)
    console.error('Errore API profilo atleta:', error)
    return noStoreJson({ error: 'Errore interno del server' }, 500)
  }
}
