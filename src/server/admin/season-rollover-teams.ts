import 'server-only'

import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'

const id = z.string().uuid()
const teamRow = z.object({ id, name: z.string(), code: z.string(), activity_id: id, is_active: z.boolean() }).strict()
const activityRow = z.object({ id, name: z.string(), season_id: id }).strict()
const activityMapRow = z.object({ source_id: id, target_id: id }).strict()

const choiceUnion = z.discriminatedUnion('choice', [
  z.object({ sourceId: id, choice: z.literal('create'), name: z.string().trim().min(1).max(255), code: z.string().trim().min(1).max(50), activityId: id }).strict(),
  z.object({ sourceId: id, choice: z.literal('link'), targetId: id }).strict(),
  z.object({ sourceId: id, choice: z.literal('skip') }).strict(),
])

export const teamChoicesSchema = z.array(choiceUnion).superRefine((choices, context) => {
  const seen = new Set<string>()
  choices.forEach((choice, index) => {
    if (seen.has(choice.sourceId)) context.addIssue({ code: 'custom', path: [index, 'sourceId'], message: 'Source duplicata' })
    seen.add(choice.sourceId)
  })
})
export type TeamChoice = z.infer<typeof choiceUnion>

const mapRow = z.object({ source_team_id: id, target_team_id: id }).strict()

export async function getTeamPreview(sourceSeasonId: string, targetSeasonId: string) {
  const source = id.parse(sourceSeasonId)
  const target = id.parse(targetSeasonId)
  const admin = createAdminClient()
  const [{ data: sourceSeason, error: sourceSeasonError }, { data: targetSeason, error: targetSeasonError }, { data: sourceActivities, error: sourceActivitiesError }, { data: targetActivities, error: targetActivitiesError }] = await Promise.all([
    admin.from('seasons').select('id,is_active').eq('id', source).maybeSingle(),
    admin.from('seasons').select('id,is_active').eq('id', target).maybeSingle(),
    admin.from('activities').select('id,name,season_id').eq('season_id', source),
    admin.from('activities').select('id,name,season_id').eq('season_id', target),
  ])
  if (sourceSeasonError || targetSeasonError || sourceActivitiesError || targetActivitiesError) throw new Error('Impossibile leggere la preview delle squadre')
  const sourceActivityIds = (sourceActivities ?? []).map((row) => row.id)
  const targetActivityIds = (targetActivities ?? []).map((row) => row.id)
  const [{ data: sourceTeams, error: sourceTeamsError }, { data: targetTeams, error: targetTeamsError }, { data: activityMaps, error: activityMapsError }, { data: teamMaps, error: teamMapsError }] = await Promise.all([
    admin.from('teams').select('id,name,code,activity_id,is_active').in('activity_id', sourceActivityIds),
    admin.from('teams').select('id,name,code,activity_id,is_active').in('activity_id', targetActivityIds),
    admin.from('season_rollover_structure_maps').select('source_id,target_id').eq('source_kind', 'activity').eq('source_season_id', source).eq('target_season_id', target),
    admin.from('season_rollover_team_maps').select('source_team_id,target_team_id').eq('source_season_id', source).eq('target_season_id', target),
  ])
  const error = sourceTeamsError ?? targetTeamsError ?? activityMapsError ?? teamMapsError
  if (error) throw new Error('Impossibile leggere la preview delle squadre')
  if (!sourceSeason || !targetSeason || source === target || targetSeason.is_active) throw new Error('Source o target non validi')
  const sourceTeamRows = z.array(teamRow).parse(sourceTeams ?? [])
  const sourceActivityRows = z.array(activityRow).parse(sourceActivities ?? [])
  const targetTeamRows = z.array(teamRow).parse(targetTeams ?? [])
  const targetActivityRows = z.array(activityRow).parse(targetActivities ?? [])
  const activityMapRows = z.array(activityMapRow).parse(activityMaps ?? [])
  const teamMapRows = z.array(mapRow).parse(teamMaps ?? [])
  const activityById = new Map(sourceActivityRows.map((row) => [row.id, row]))
  const targetActivityById = new Map(targetActivityRows.map((row) => [row.id, row]))
  const mappedActivity = new Map(activityMapRows.map((row) => [row.source_id, row.target_id]))
  return {
    teams: sourceTeamRows.map((team) => {
      const sourceActivity = activityById.get(team.activity_id)
      const mappedActivityId = mappedActivity.get(team.activity_id) ?? null
      const targetActivityId = mappedActivityId ?? null
      return {
        source: { ...team, activity: sourceActivity ?? null },
        mappedActivity: targetActivityId ? targetActivityById.get(targetActivityId) ?? null : null,
        targetMatches: targetTeamRows.filter((candidate) => candidate.name.trim().toLocaleLowerCase() === team.name.trim().toLocaleLowerCase()),
        mappedTargetId: teamMapRows.find((row) => row.source_team_id === team.id)?.target_team_id ?? null,
        proposedCode: `${team.code}-2627`.slice(0, 50),
      }
    }),
    targetTeams: targetTeamRows.map((team) => ({ ...team, activity: targetActivityById.get(team.activity_id) ?? null })),
  }
}

export async function applyTeamChoices(sourceSeasonId: string, targetSeasonId: string, teams: TeamChoice[]) {
  const parsed = teamChoicesSchema.parse(teams)
  const { data, error } = await createAdminClient().rpc('rollover_teams_batch', { p_source_season_id: id.parse(sourceSeasonId), p_target_season_id: id.parse(targetSeasonId), p_teams: parsed })
  if (error) throw new Error('Impossibile applicare le scelte delle squadre')
  return z.object({ created: z.number(), linked: z.number(), skipped: z.number() }).parse(data)
}
