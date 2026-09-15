import 'server-only'

import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'

const id = z.string().uuid()

const sourceSeasonRow = z.object({ id, is_active: z.boolean() }).strict()
const profileRow = z.object({ id, first_name: z.string(), last_name: z.string() }).strict()
const seasonProfileRow = z.object({ profile_id: id, profile_type: z.string().nullable(), status: z.string() }).strict()
const teamRow = z.object({ id, name: z.string(), code: z.string(), activity_id: id }).strict()
const activityRow = z.object({ id, season_id: id }).strict()
const teamMemberRow = z.object({ profile_id: id, team_id: id, role: z.string(), jersey_number: z.number().nullable() }).strict()
const teamCoachRow = z.object({ coach_id: id, team_id: id, role: z.string() }).strict()
const teamMapRow = z.object({ source_team_id: id, target_team_id: id }).strict()
const relationshipRow = z.object({
  source_profile_id: id,
  target_profile_id: id,
  relationship_type: z.string(),
  status: z.string(),
  valid_from: z.string(),
  valid_until: z.string().nullable(),
  can_view_schedule: z.boolean(),
  can_confirm_attendance: z.boolean(),
  can_view_payments: z.boolean(),
  can_view_medical_status: z.boolean(),
  can_view_documents: z.boolean(),
  can_sign_documents: z.boolean(),
  can_receive_messages: z.boolean(),
}).strict()

export const previewWarningCode = z.enum([
  'mapping_missing',
  'target_already_enrolled',
  'no_team',
  'inactive_profile',
  'classification_inconsistent',
])
export type PreviewWarningCode = z.infer<typeof previewWarningCode>

export type ProfilePreview = {
  profile: { id: string; firstName: string; lastName: string }
  category: 'athlete' | 'collaborator'
  profileType: string | null
  status: string
  sourceTeams: Array<{ id: string; name: string; code: string; jerseyNumber: number | null; role: string }>
  targetTeams: Array<{ id: string; name: string; code: string; sourceTeamId: string }>
  target: { enrolled: boolean; status: string | null; teamIds: string[] }
  family: Array<{ relationshipType: string; permissions: string[] }>
  warnings: Array<{ code: PreviewWarningCode; message: string }>
}

function isActiveRelationship(row: z.infer<typeof relationshipRow>, today: string): boolean {
  return row.status === 'active' && row.valid_from <= today && (row.valid_until === null || row.valid_until >= today)
}

function permissions(row: z.infer<typeof relationshipRow>): string[] {
  const entries: Array<[string, boolean]> = [
    ['view_schedule', row.can_view_schedule],
    ['confirm_attendance', row.can_confirm_attendance],
    ['view_payments', row.can_view_payments],
    ['view_medical_status', row.can_view_medical_status],
    ['view_documents', row.can_view_documents],
    ['sign_documents', row.can_sign_documents],
    ['receive_messages', row.can_receive_messages],
  ]
  return entries.filter((entry) => entry[1]).map(([name]) => name)
}

function warning(code: PreviewWarningCode): { code: PreviewWarningCode; message: string } {
  const messages: Record<PreviewWarningCode, string> = {
    mapping_missing: 'Una o più squadre source non hanno una squadra target mappata',
    target_already_enrolled: 'Il profilo è già iscritto alla stagione target',
    no_team: 'Il profilo non ha squadre source',
    inactive_profile: 'Il profilo stagionale non è attivo',
    classification_inconsistent: 'La classificazione stagionale non coincide con le assegnazioni',
  }
  return { code, message: messages[code] }
}

export async function getProfilePreview(sourceSeasonId: string, targetSeasonId: string): Promise<{
  sourceSeason: { id: string; isActive: boolean }
  targetSeason: { id: string; isActive: boolean }
  athletes: ProfilePreview[]
  collaborators: ProfilePreview[]
}> {
  const source = id.parse(sourceSeasonId)
  const target = id.parse(targetSeasonId)
  if (source === target) throw new Error('Source e target devono essere diverse')

  const admin = createAdminClient()
  const [sourceSeasonResult, targetSeasonResult, sourceSeasonProfilesResult, targetSeasonProfilesResult, activitiesResult, mapsResult, relationshipsResult] = await Promise.all([
    admin.from('seasons').select('id,is_active').eq('id', source).maybeSingle(),
    admin.from('seasons').select('id,is_active').eq('id', target).maybeSingle(),
    admin.from('season_profiles').select('profile_id,profile_type,status').eq('season_id', source),
    admin.from('season_profiles').select('profile_id,profile_type,status').eq('season_id', target),
    admin.from('activities').select('id,season_id'),
    admin.from('season_rollover_team_maps').select('source_team_id,target_team_id').eq('source_season_id', source).eq('target_season_id', target),
    admin.from('profile_relationships').select('source_profile_id,target_profile_id,relationship_type,status,valid_from,valid_until,can_view_schedule,can_confirm_attendance,can_view_payments,can_view_medical_status,can_view_documents,can_sign_documents,can_receive_messages'),
  ])
  const firstError = [sourceSeasonResult, targetSeasonResult, sourceSeasonProfilesResult, targetSeasonProfilesResult, activitiesResult, mapsResult, relationshipsResult].find((result) => result.error)?.error
  if (firstError) throw new Error('Impossibile leggere la preview dei profili')

  const sourceSeason = sourceSeasonRow.parse(sourceSeasonResult.data)
  const targetSeason = sourceSeasonRow.parse(targetSeasonResult.data)
  if (targetSeason.is_active) throw new Error('La stagione target deve essere inattiva')
  const sourceProfiles = z.array(seasonProfileRow).parse(sourceSeasonProfilesResult.data ?? [])
  const targetProfiles = z.array(seasonProfileRow).parse(targetSeasonProfilesResult.data ?? [])
  const activities = z.array(activityRow).parse(activitiesResult.data ?? [])
  const sourceActivityIds = new Set(activities.filter((row) => row.season_id === source).map((row) => row.id))
  const targetActivityIds = new Set(activities.filter((row) => row.season_id === target).map((row) => row.id))

  const [profilesResult, teamsResult, membersResult, coachesResult] = await Promise.all([
    admin.from('profiles').select('id,first_name,last_name').in('id', sourceProfiles.map((row) => row.profile_id)),
    admin.from('teams').select('id,name,code,activity_id').in('activity_id', [...sourceActivityIds, ...targetActivityIds]),
    admin.from('team_members').select('profile_id,team_id,role,jersey_number'),
    admin.from('team_coaches').select('coach_id,team_id,role'),
  ])
  const secondError = [profilesResult, teamsResult, membersResult, coachesResult].find((result) => result.error)?.error
  if (secondError) throw new Error('Impossibile leggere la preview dei profili')

  const profiles = z.array(profileRow).parse(profilesResult.data ?? [])
  const teams = z.array(teamRow).parse(teamsResult.data ?? [])
  const members = z.array(teamMemberRow).parse(membersResult.data ?? [])
  const coaches = z.array(teamCoachRow).parse(coachesResult.data ?? [])
  const maps = z.array(teamMapRow).parse(mapsResult.data ?? [])
  const relationships = z.array(relationshipRow).parse(relationshipsResult.data ?? [])
  const profileById = new Map(profiles.map((row) => [row.id, row]))
  const teamById = new Map(teams.map((row) => [row.id, row]))
  const targetProfileById = new Map(targetProfiles.map((row) => [row.profile_id, row]))
  const targetTeamById = new Map(teams.filter((row) => targetActivityIds.has(row.activity_id)).map((row) => [row.id, row]))
  const mapBySource = new Map(maps.map((row) => [row.source_team_id, row.target_team_id]))
  const today = new Date().toISOString().slice(0, 10)

  const previews = sourceProfiles.map((seasonProfile): ProfilePreview => {
    const profile = profileById.get(seasonProfile.profile_id)
    if (!profile) throw new Error('Profilo stagionale senza anagrafica')
    const sourceTeams = [
      ...members.filter((row) => row.profile_id === seasonProfile.profile_id && teamById.get(row.team_id) && sourceActivityIds.has(teamById.get(row.team_id)!.activity_id)).map((row) => ({ team: teamById.get(row.team_id)!, jerseyNumber: row.jersey_number, role: row.role })),
      ...coaches.filter((row) => row.coach_id === seasonProfile.profile_id && teamById.get(row.team_id) && sourceActivityIds.has(teamById.get(row.team_id)!.activity_id)).map((row) => ({ team: teamById.get(row.team_id)!, jerseyNumber: null, role: row.role })),
    ]
    const targetTeams = sourceTeams.flatMap(({ team }) => {
      const targetTeamId = mapBySource.get(team.id)
      const targetTeam = targetTeamId ? targetTeamById.get(targetTeamId) : undefined
      return targetTeam ? [{ id: targetTeam.id, name: targetTeam.name, code: targetTeam.code, sourceTeamId: team.id }] : []
    })
    const uniqueTargetTeams = [...new Map(targetTeams.map((team) => [team.id, team])).values()]
    const targetProfile = targetProfileById.get(seasonProfile.profile_id)
    const warningCodes = new Set<PreviewWarningCode>()
    if (targetProfile) warningCodes.add('target_already_enrolled')
    if (seasonProfile.status !== 'active') warningCodes.add('inactive_profile')
    if (sourceTeams.length === 0) warningCodes.add('no_team')
    if (sourceTeams.some(({ team }) => !mapBySource.has(team.id))) warningCodes.add('mapping_missing')
    const expectedRole = seasonProfile.profile_type === 'athlete' ? 'athlete' : 'collaborator'
    if (!['athlete', 'coach', 'staff', 'admin'].includes(seasonProfile.profile_type ?? '') || sourceTeams.some(({ role }) => expectedRole === 'athlete' ? role !== 'athlete' : role === 'athlete')) warningCodes.add('classification_inconsistent')
    const family = seasonProfile.profile_type === 'athlete' ? relationships.filter((row) => row.target_profile_id === seasonProfile.profile_id && isActiveRelationship(row, today)).map((row) => ({ relationshipType: row.relationship_type, permissions: permissions(row) })) : []
    const targetTeamIds = new Set([
      ...members.filter((row) => row.profile_id === seasonProfile.profile_id && targetTeamById.has(row.team_id)).map((row) => row.team_id),
      ...coaches.filter((row) => row.coach_id === seasonProfile.profile_id && targetTeamById.has(row.team_id)).map((row) => row.team_id),
    ])
    return {
      profile: { id: profile.id, firstName: profile.first_name, lastName: profile.last_name },
      category: seasonProfile.profile_type === 'athlete' ? 'athlete' : 'collaborator',
      profileType: seasonProfile.profile_type,
      status: seasonProfile.status,
      sourceTeams: sourceTeams.map(({ team, jerseyNumber, role }) => ({ id: team.id, name: team.name, code: team.code, jerseyNumber, role })),
      targetTeams: uniqueTargetTeams,
      target: { enrolled: Boolean(targetProfile), status: targetProfile?.status ?? null, teamIds: [...targetTeamIds] },
      family,
      warnings: [...warningCodes].map(warning),
    }
  })
  return { sourceSeason: { id: sourceSeason.id, isActive: sourceSeason.is_active }, targetSeason: { id: targetSeason.id, isActive: targetSeason.is_active }, athletes: previews.filter((preview) => preview.category === 'athlete'), collaborators: previews.filter((preview) => preview.category === 'collaborator') }
}
