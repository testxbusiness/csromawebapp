import 'server-only'

import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'

const id = z.string().uuid()
const structure = z.object({ id, name: z.string(), season_id: id }).strict()
const mapRow = z.object({ source_kind: z.enum(['gym', 'activity']), source_id: id, target_id: id }).strict()

const choiceUnion = z.discriminatedUnion('choice', [
  z.object({ sourceId: id, choice: z.literal('copy') }).strict(),
  z.object({ sourceId: id, choice: z.literal('link'), targetId: id }).strict(),
  z.object({ sourceId: id, choice: z.literal('skip') }).strict(),
])
export const structureChoiceItemSchema = choiceUnion
export const structureChoicesSchema = z.array(choiceUnion).superRefine((choices, context) => {
  const seen = new Set<string>()
  choices.forEach((choice, index) => {
    if (seen.has(choice.sourceId)) context.addIssue({ code: 'custom', path: [index, 'sourceId'], message: 'Source duplicata' })
    seen.add(choice.sourceId)
  })
})
export type StructureChoice = z.infer<typeof structureChoiceItemSchema>

export async function getStructurePreview(sourceSeasonId: string, targetSeasonId: string) {
  const source = id.parse(sourceSeasonId)
  const target = id.parse(targetSeasonId)
  const admin = createAdminClient()
  const [{ data: sourceSeason, error: sourceSeasonError }, { data: targetSeason, error: targetSeasonError }, { data: gyms, error: gymsError }, { data: activities, error: activitiesError }, { data: targetGyms, error: targetGymsError }, { data: targetActivities, error: targetActivitiesError }, { data: mappings, error: mappingsError }] = await Promise.all([
    admin.from('seasons').select('id,is_active').eq('id', source).maybeSingle(),
    admin.from('seasons').select('id,is_active').eq('id', target).maybeSingle(),
    admin.from('gyms').select('id,name,season_id').eq('season_id', source),
    admin.from('activities').select('id,name,season_id').eq('season_id', source),
    admin.from('gyms').select('id,name,season_id').eq('season_id', target),
    admin.from('activities').select('id,name,season_id').eq('season_id', target),
    admin.from('season_rollover_structure_maps').select('source_kind,source_id,target_id').eq('target_season_id', target),
  ])
  const error = sourceSeasonError ?? targetSeasonError ?? gymsError ?? activitiesError ?? targetGymsError ?? targetActivitiesError ?? mappingsError
  if (error) throw new Error('Impossibile leggere la preview delle strutture')
  if (!sourceSeason || !targetSeason || source === target || targetSeason.is_active) throw new Error('Source o target non validi')
  const parse = (rows: unknown) => z.array(structure).parse(rows ?? [])
  const targetGymRows = parse(targetGyms)
  const targetActivityRows = parse(targetActivities)
  const mappingRows = z.array(mapRow).parse(mappings ?? [])
  const match = (kind: 'gym' | 'activity', rows: z.infer<typeof structure>[], targetRows: z.infer<typeof structure>[]) => rows.map((row) => ({
    source: row,
    matches: targetRows.filter((candidate) => candidate.name.trim().toLocaleLowerCase() === row.name.trim().toLocaleLowerCase()),
    mappedTargetId: mappingRows.find((mapping) => mapping.source_kind === kind && mapping.source_id === row.id)?.target_id ?? null,
  }))
  return { gyms: match('gym', parse(gyms), targetGymRows), activities: match('activity', parse(activities), targetActivityRows) }
}

export async function applyStructureChoices(sourceSeasonId: string, targetSeasonId: string, gyms: StructureChoice[], activities: StructureChoice[]) {
  const parsedGyms = structureChoicesSchema.parse(gyms)
  const parsedActivities = structureChoicesSchema.parse(activities)
  const { data, error } = await createAdminClient().rpc('rollover_structures_batch', {
    p_source_season_id: id.parse(sourceSeasonId), p_target_season_id: id.parse(targetSeasonId), p_gyms: parsedGyms, p_activities: parsedActivities,
  })
  if (error) throw new Error('Impossibile applicare le scelte delle strutture')
  return z.record(z.string(), z.number()).parse(data)
}
