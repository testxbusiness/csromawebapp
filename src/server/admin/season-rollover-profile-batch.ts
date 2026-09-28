import 'server-only'

import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'

const id = z.string().uuid()

const teamAssignmentSchema = z.object({
  teamId: id,
  role: z.string().trim().min(1).max(50),
  jerseyNumber: z.number().int().min(0).max(99).nullable().optional(),
}).strict()

const profileSelectionSchema = z.object({
  profileId: id,
  included: z.boolean(),
  teams: z.array(teamAssignmentSchema).max(50).default([]),
}).strict()

export const profileBatchSchema = z.object({
  batchId: id,
  sourceSeasonId: id,
  targetSeasonId: id,
  selections: z.array(profileSelectionSchema).max(5000),
}).strict().superRefine((payload, context) => {
  if (payload.sourceSeasonId === payload.targetSeasonId) {
    context.addIssue({ code: 'custom', path: ['targetSeasonId'], message: 'Source e target devono essere diverse' })
  }
  const profiles = new Set<string>()
  payload.selections.forEach((selection, index) => {
    if (profiles.has(selection.profileId)) {
      context.addIssue({ code: 'custom', path: ['selections', index, 'profileId'], message: 'Profilo duplicato nel batch' })
    }
    profiles.add(selection.profileId)
    const teams = new Set<string>()
    selection.teams.forEach((team, teamIndex) => {
      if (teams.has(team.teamId)) {
        context.addIssue({ code: 'custom', path: ['selections', index, 'teams', teamIndex, 'teamId'], message: 'Squadra duplicata per il profilo' })
      }
      teams.add(team.teamId)
    })
  })
})

export type ProfileBatchInput = z.infer<typeof profileBatchSchema>

const profileBatchResultSchema = z.object({
  batchKey: id,
  included: z.number().int().nonnegative(),
  excluded: z.number().int().nonnegative(),
  withoutTeam: z.number().int().nonnegative(),
  teamMembers: z.number().int().nonnegative(),
  teamCoaches: z.number().int().nonnegative(),
  warnings: z.number().int().nonnegative(),
  replayed: z.boolean(),
}).strict()

export type ProfileBatchResult = z.infer<typeof profileBatchResultSchema>

export async function applyProfileBatch(
  input: ProfileBatchInput,
  performedByAuthUserId: string
): Promise<ProfileBatchResult> {
  const payload = profileBatchSchema.parse(input)
  const actor = id.parse(performedByAuthUserId)
  const { data, error } = await createAdminClient().rpc('rollover_profiles_batch', {
    p_batch_key: payload.batchId,
    p_source_season_id: payload.sourceSeasonId,
    p_target_season_id: payload.targetSeasonId,
    p_performed_by_auth_user_id: actor,
    p_selections: payload.selections,
  })
  if (error) throw new Error('Impossibile applicare le iscrizioni della stagione')
  return profileBatchResultSchema.parse(data)
}
