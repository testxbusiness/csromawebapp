import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { noStoreJson } from '@/server/http/no-store'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireSubjectAthleteContext } from '@/server/auth/require-subject-profile'
import { buildAthleteProfileContract } from '@/server/profile/athlete-profile'
import { finishRequestResponse, startRequestTiming } from '@/server/performance/request-timing'

export async function GET(request: NextRequest) {
  const timing = startRequestTiming(request, '/api/athlete/profile')
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const subject = timing
      ? await requireSubjectAthleteContext(supabase, searchParams.get('subjectProfileId'), undefined, timing)
      : await requireSubjectAthleteContext(supabase, searchParams.get('subjectProfileId'))
    const client = subject.dataClient
    const activeTeamIds = subject.activeTeamIds ?? []

    const baseQueriesStartedAt = timing?.now() ?? 0
    const [{ data: profile, error: profileError }, { data: athleteProfile, error: athleteError }, { data: memberships, error: membershipsError }] = await Promise.all([
      client.from('profiles').select('id, first_name, last_name, email, phone, birth_date').eq('id', subject.profileId).maybeSingle(),
      client.from('athlete_profiles').select('profile_id, membership_number, medical_certificate_expiry').eq('profile_id', subject.profileId).maybeSingle(),
      client.from('team_members').select('id, team_id, jersey_number').eq('profile_id', subject.profileId).in('team_id', activeTeamIds),
    ])
    timing?.mark('profile-athlete-memberships', baseQueriesStartedAt)

    if (profileError || athleteError || membershipsError) {
      console.error('Errore caricamento profilo atleta:', profileError || athleteError || membershipsError)
      return finishRequestResponse(noStoreJson({ error: 'Impossibile caricare il profilo atleta' }, 500), timing)
    }
    if (!profile) return finishRequestResponse(noStoreJson({ error: 'Profilo atleta non trovato' }, 404), timing)

    const safeMemberships = memberships ?? []
    const teamIds = [...new Set(safeMemberships.map((membership) => membership.team_id))]
    const documentsStartedAt = timing?.now() ?? 0
    const personalDocumentsPromise = subject.permissions.view_documents
      ? Promise.resolve(client.from('documents')
          .select('id, title, status, file_name, created_at')
          .eq('target_user_id', subject.profileId)
          .in('status', ['generated', 'sent']))
      : Promise.resolve({ data: [], error: null })

    const teamsStartedAt = timing?.now() ?? 0
    const { data: teams, error: teamsError } = teamIds.length
      ? await client.from('teams').select('id, name, code, activity_id').in('id', teamIds)
      : { data: [], error: null }
    timing?.mark('teams', teamsStartedAt)
    if (teamsError) {
      console.error('Errore caricamento squadre profilo atleta:', teamsError)
      return finishRequestResponse(noStoreJson({ error: 'Impossibile caricare le squadre del profilo' }, 500), timing)
    }

    const safeTeams = teams ?? []
    const activityIds = [...new Set(safeTeams.map((team) => team.activity_id))]
    const activitiesStartedAt = timing?.now() ?? 0
    const activitiesPromise = activityIds.length
      ? client.from('activities').select('id, name').in('id', activityIds)
      : Promise.resolve({ data: [], error: null })
    const teamDocumentsPromise = subject.permissions.view_documents && safeTeams.length
      ? client.from('documents')
          .select('id, title, status, file_name, created_at')
          .in('target_team_id', safeTeams.map((team) => team.id))
          .in('status', ['generated', 'sent'])
      : Promise.resolve({ data: [], error: null })
    const [{ data: activities, error: activitiesError }, [personalDocuments, teamDocuments]] = await Promise.all([
      activitiesPromise,
      Promise.all([personalDocumentsPromise, teamDocumentsPromise]),
    ])
    timing?.mark('activities', activitiesStartedAt)
    timing?.mark('documents', documentsStartedAt)
    const documents = {
      rows: [...(personalDocuments.data ?? []), ...(teamDocuments.data ?? [])]
        .filter((document, index, all) => all.findIndex((candidate) => candidate.id === document.id) === index),
      error: personalDocuments.error ?? teamDocuments.error,
    }
    if (activitiesError) {
      console.error('Errore caricamento attività profilo atleta:', activitiesError)
      return finishRequestResponse(noStoreJson({ error: 'Impossibile caricare le attività del profilo' }, 500), timing)
    }
    if (documents.error) {
      console.error('Errore caricamento documenti profilo atleta:', documents.error)
      return finishRequestResponse(noStoreJson({ error: 'Impossibile caricare i documenti del profilo' }, 500), timing)
    }

    return finishRequestResponse(noStoreJson(buildAthleteProfileContract({
      account: subject.account,
      subject,
      profile,
      athleteProfile,
      memberships: safeMemberships,
      teams: new Map((safeTeams).map((team) => [team.id, team])),
      activities: new Map((activities ?? []).map((activity) => [activity.id, activity])),
      documents: documents.rows,
    })), timing)
  } catch (error) {
    if (error instanceof AccountContextError) return finishRequestResponse(noStoreJson({ error: error.message }, error.status), timing)
    console.error('Errore API profilo atleta:', error)
    return finishRequestResponse(noStoreJson({ error: 'Errore interno del server' }, 500), timing)
  }
}
