import type { TeamDetailData } from '@/components/shared/TeamDetailModal'
import type { SubjectAthleteContext } from '@/server/auth/require-subject-profile'
import { AccountContextError } from '@/server/auth/require-account-context'

function firstRelation<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined
}

type TeamRow = { name: string; code: string; activities?: { name: string } | { name: string }[] | null }
type ScheduleRow = { day_of_week: number; start_time: string; end_time: string; gyms?: { name: string; city: string | null } | { name: string; city: string | null }[] | null }
type CoachRow = { coach_id: string; role: string }
type MemberRow = { profile_id: string; jersey_number: number | null }
type ProfileRow = { id: string; first_name: string; last_name: string }

export async function loadAthleteTeamDetail(subject: SubjectAthleteContext, teamId: string): Promise<TeamDetailData> {
  if (!(subject.activeTeamIds ?? []).includes(teamId)) {
    throw new AccountContextError('Squadra non autorizzata per il soggetto', 403)
  }

  const { data: membership, error: membershipError } = await subject.dataClient
    .from('team_members')
    .select('team_id')
    .eq('team_id', teamId)
    .eq('profile_id', subject.profileId)
    .maybeSingle()
  if (membershipError) throw new AccountContextError('Impossibile verificare la squadra del soggetto', 500)
  if (!membership) throw new AccountContextError('Squadra non autorizzata per il soggetto', 403)

  const [{ data: teamData, error: teamError }, { data: schedules, error: schedulesError }, { data: coachesData, error: coachesError }, { data: membersData, error: membersError }] = await Promise.all([
    subject.dataClient.from('teams').select('name, code, activity_id, activities(name)').eq('id', teamId).maybeSingle(),
    subject.dataClient.from('team_training_schedules').select('day_of_week, start_time, end_time, gym_id, gyms(name, city)').eq('team_id', teamId).eq('is_active', true).order('day_of_week, start_time'),
    subject.dataClient.from('team_coaches').select('coach_id, role').eq('team_id', teamId),
    subject.dataClient.from('team_members').select('profile_id, jersey_number').eq('team_id', teamId).order('jersey_number'),
  ])
  if (teamError || schedulesError || coachesError || membersError) {
    throw new AccountContextError('Impossibile caricare il dettaglio della squadra', 500)
  }
  if (!teamData) throw new AccountContextError('Squadra non trovata', 404)

  const coaches = (coachesData ?? []) as CoachRow[]
  const members = (membersData ?? []) as MemberRow[]
  const profileIds = [...new Set([...coaches.map((coach) => coach.coach_id), ...members.map((member) => member.profile_id)])]
  const { data: profilesData, error: profilesError } = profileIds.length > 0
    ? await subject.dataClient.from('profiles').select('id, first_name, last_name').in('id', profileIds)
    : { data: [], error: null }
  if (profilesError) throw new AccountContextError('Impossibile caricare i profili della squadra', 500)

  const profiles = new Map((profilesData ?? []).map((profile) => [profile.id, profile as ProfileRow]))
  const team = teamData as TeamRow
  const activity = firstRelation(team.activities)
  return {
    name: team.name,
    code: team.code,
    activity: activity ? { name: activity.name } : undefined,
    training_schedules: (schedules ?? []).map((schedule) => {
      const row = schedule as ScheduleRow
      const gym = firstRelation(row.gyms)
      return { day_of_week: row.day_of_week, start_time: row.start_time, end_time: row.end_time, gym: { name: gym?.name || 'N/D', city: gym?.city ?? undefined } }
    }),
    coaches: coaches.map((coach) => ({ id: coach.coach_id, first_name: profiles.get(coach.coach_id)?.first_name || '', last_name: profiles.get(coach.coach_id)?.last_name || '', role: coach.role })),
    athletes: members.map((member) => ({ id: member.profile_id, first_name: profiles.get(member.profile_id)?.first_name || '', last_name: profiles.get(member.profile_id)?.last_name || '', jersey_number: member.jersey_number ?? undefined })),
  }
}
