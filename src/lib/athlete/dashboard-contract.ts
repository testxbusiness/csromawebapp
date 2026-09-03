import type {
  AthleteDashboardContract,
  AthleteDashboardTeam,
} from '@/types/athlete-dashboard'

type RawTeam = {
  id: string
  name: string
  code: string
  activity_id?: string | null
}

type RawActivity = { id: string; name: string }

type RawEvent = {
  id: string
  title: string
  start_time: string
  end_time: string
  location?: string | null
  gym_id?: string | null
  description?: string | null
  event_kind?: string | null
  requires_confirmation?: boolean | null
  confirmation_deadline?: string | null
}

type RawEventTeamLink = { event_id: string; team_id: string }

type RawMembership = { id: string; team_id: string; jersey_number?: number | null }

type RawFeeInstallment = {
  id: string
  installment_number: number
  due_date: string
  amount: number
  status: string
  membership_fee_id: string
}

type RawFee = { id: string; team_id: string; name: string }

type RawMessage = {
  id: string
  subject: string
  content: string
  created_at: string
  created_by_profile?: { first_name?: string | null; last_name?: string | null } | null
}

type RawMessageRecipient = {
  team_id?: string | null
  is_read?: boolean | null
  message: RawMessage
}

export function teamShape(
  team: RawTeam | undefined,
  activities: Map<string, RawActivity>,
): AthleteDashboardTeam | null {
  if (!team) return null
  const activity = team.activity_id ? activities.get(team.activity_id) : undefined
  return {
    id: team.id,
    name: team.name,
    code: team.code,
    activity: activity ? { id: activity.id, name: activity.name } : null,
  }
}

export function buildEventTeamMap(
  links: RawEventTeamLink[],
  teams: Map<string, AthleteDashboardTeam>,
): Map<string, AthleteDashboardTeam[]> {
  const result = new Map<string, AthleteDashboardTeam[]>()
  for (const link of links) {
    const team = teams.get(link.team_id)
    if (!team) continue
    const current = result.get(link.event_id) ?? []
    if (!current.some((item) => item.id === team.id)) current.push(team)
    result.set(link.event_id, current)
  }
  return result
}

export function buildDashboardEvents(
  events: RawEvent[],
  eventTeams: Map<string, AthleteDashboardTeam[]>,
  gyms: Map<string, { name: string; city?: string | null }>,
  attendance: Map<string, { status: string; responded_at?: string | null }>,
) {
  return events.map((event) => {
    const gym = event.gym_id ? gyms.get(event.gym_id) : undefined
    return {
      ...event,
      location: gym?.name ? `${gym.name}${gym.city ? ` - ${gym.city}` : ''}` : event.location || null,
      requires_confirmation: Boolean(event.requires_confirmation),
      confirmation_deadline: event.confirmation_deadline || null,
      my_attendance: attendance.get(event.id) || null,
      /** Additive fields; existing event fields remain unchanged. */
      teams: eventTeams.get(event.id) ?? [],
      team_ids: (eventTeams.get(event.id) ?? []).map((team) => team.id),
    }
  })
}

export function buildDashboardMemberships(
  memberships: RawMembership[],
  teams: Map<string, AthleteDashboardTeam>,
) {
  return memberships.flatMap((membership) => {
    const team = teams.get(membership.team_id)
    if (!team) return []
    return [{
      id: membership.id,
      jersey_number: membership.jersey_number,
      team,
      /** Explicit relation context for future team filtering. */
      team_id: team.id,
    }]
  })
}

export function buildDashboardFees(
  installments: RawFeeInstallment[],
  fees: Map<string, RawFee>,
  teams: Map<string, AthleteDashboardTeam>,
) {
  return installments.flatMap((installment) => {
    const fee = fees.get(installment.membership_fee_id)
    const team = fee ? teams.get(fee.team_id) : undefined
    if (!fee) return []
    return [{
      ...installment,
      membership_fee: {
        id: fee.id,
        name: fee.name,
        team: team ?? { id: fee.team_id, name: 'N/A', code: 'N/A', activity: null },
      },
    }]
  })
}

export function buildUnreadMessages(
  recipients: RawMessageRecipient[],
  readMessageIds: Set<string>,
  teams: Map<string, AthleteDashboardTeam>,
) {
  const messages = new Map<string, {
    id: string
    subject: string
    content: string
    created_at: string
    is_read: false
    created_by_profile: RawMessage['created_by_profile']
    teams: AthleteDashboardTeam[]
    team_ids: string[]
    dedupe_key: string
    read_state: { is_read: boolean; read_at: string | null }
  }>()

  for (const recipient of recipients) {
    if (readMessageIds.has(recipient.message.id)) continue
    const existing = messages.get(recipient.message.id)
    const team = recipient.team_id ? teams.get(recipient.team_id) : undefined
    if (existing) {
      if (team && !existing.teams.some((item) => item.id === team.id)) {
        existing.teams.push(team)
        existing.team_ids.push(team.id)
      }
      continue
    }
    messages.set(recipient.message.id, {
      ...recipient.message,
      dedupe_key: recipient.message.id,
      is_read: false,
      read_state: { is_read: false, read_at: null },
      created_by_profile: recipient.message.created_by_profile ?? null,
      teams: team ? [team] : [],
      team_ids: team ? [team.id] : [],
    })
  }
  return [...messages.values()].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function resolveMatchPerspective(
  match: {
    home_club_team?: { id: string; name: string; code?: string; team_id?: string | null } | null
    away_club_team?: { id: string; name: string; code?: string; team_id?: string | null } | null
  },
  athleteTeams: Map<string, AthleteDashboardTeam>,
) {
  const home = match.home_club_team
  const away = match.away_club_team
  const athleteIsHome = Boolean(home?.team_id && athleteTeams.has(home.team_id))
  const athleteClubTeam = athleteIsHome ? home : away
  const opponentClubTeam = athleteIsHome ? away : home
  return {
    team: athleteClubTeam?.team_id ? athleteTeams.get(athleteClubTeam.team_id) ?? null : null,
    opponent: opponentClubTeam
      ? { id: opponentClubTeam.id, name: opponentClubTeam.name, code: opponentClubTeam.code }
      : null,
    is_home: Boolean(athleteClubTeam && athleteIsHome),
  }
}

export function buildDashboardContract(input: Omit<AthleteDashboardContract, 'teams' | 'unreadMessageCount'> & {
  teams: AthleteDashboardTeam[]
  unreadMessageCount: number
}): AthleteDashboardContract {
  return input
}
