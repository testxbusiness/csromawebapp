import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { useAuth } from '@/hooks/useAuth'
import { athleteKeys } from '@/lib/query-keys'
import type { TeamDetailData } from '@/components/shared/TeamDetailModal'

const TEAM_DETAIL_STALE_TIME = 10 * 60 * 1000

function firstRelation<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined
}

async function fetchTeamDetail(teamId: string, signal: AbortSignal): Promise<TeamDetailData> {
  const supabase = createClient()
  const [{ data: teamData }, { data: schedules }, { data: coachesData }, { data: membersData }] = await Promise.all([
    supabase.from('teams').select('name, code, activity_id, activities(name)').eq('id', teamId).single(),
    supabase.from('team_training_schedules').select('day_of_week, start_time, end_time, gym_id, gyms(name, city)').eq('team_id', teamId).eq('is_active', true).order('day_of_week, start_time'),
    supabase.from('team_coaches').select('coach_id, role').eq('team_id', teamId),
    supabase.from('team_members').select('profile_id, jersey_number').eq('team_id', teamId).order('jersey_number'),
  ])
  if (signal.aborted || !teamData) throw new Error('team_not_found')

  const coachIds = coachesData?.map((coach) => coach.coach_id).filter(Boolean) ?? []
  const memberIds = membersData?.map((member) => member.profile_id).filter(Boolean) ?? []
  const profileIds = [...coachIds, ...memberIds]
  const { data: profilesData } = profileIds.length > 0
    ? await supabase.from('profiles').select('id, first_name, last_name').in('id', profileIds)
    : { data: [] }
  const profilesMap = new Map((profilesData ?? []).map((profile) => [profile.id, profile]))

  return {
    name: teamData.name,
    code: teamData.code,
    activity: firstRelation(teamData.activities) ? { name: firstRelation(teamData.activities)!.name } : undefined,
    training_schedules: schedules?.map((schedule) => ({
      day_of_week: schedule.day_of_week,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      gym: { name: firstRelation(schedule.gyms)?.name || 'N/D', city: firstRelation(schedule.gyms)?.city },
    })) ?? [],
    coaches: coachesData?.map((coach) => ({
      id: coach.coach_id,
      first_name: profilesMap.get(coach.coach_id)?.first_name || '',
      last_name: profilesMap.get(coach.coach_id)?.last_name || '',
      role: coach.role,
    })) ?? [],
    athletes: membersData?.map((member) => ({
      id: member.profile_id,
      first_name: profilesMap.get(member.profile_id)?.first_name || '',
      last_name: profilesMap.get(member.profile_id)?.last_name || '',
      jersey_number: member.jersey_number,
    })) ?? [],
  }
}

export function useAthleteTeamDetailQuery(teamId: string | null) {
  const { account, user } = useAuth()
  const { selectedProfileId } = useAccessibleProfiles()
  const accountId = account?.authUserId ?? user?.id ?? null
  const subjectProfileId = selectedProfileId ?? account?.ownerProfileId ?? null
  const queryKey = accountId && subjectProfileId && teamId
    ? athleteKeys.teamDetail(accountId, subjectProfileId, teamId)
    : athleteKeys.teamDetail('anonymous', 'unavailable', teamId ?? 'unavailable')
  return useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchTeamDetail(teamId!, signal),
    enabled: Boolean(accountId && subjectProfileId && teamId),
    retry: false,
    staleTime: TEAM_DETAIL_STALE_TIME,
  })
}
