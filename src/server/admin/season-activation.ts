import 'server-only'

import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'

const id = z.string().uuid()

export const seasonActivationSchema = z.object({
  activationId: id,
  sourceSeasonId: id,
  targetSeasonId: id,
}).strict().superRefine((payload, context) => {
  if (payload.sourceSeasonId === payload.targetSeasonId) {
    context.addIssue({ code: 'custom', path: ['targetSeasonId'], message: 'Source e target devono essere diverse' })
  }
})

export type SeasonActivationInput = z.infer<typeof seasonActivationSchema>

const seasonActivationResultSchema = z.object({
  activationKey: id,
  sourceSeasonId: id,
  targetSeasonId: id,
  activatedAt: z.string().datetime({ offset: true }),
  replayed: z.boolean(),
}).strict()

export type SeasonActivationResult = z.infer<typeof seasonActivationResultSchema>

export async function activateSeason(
  input: SeasonActivationInput,
  performedByAuthUserId: string,
): Promise<SeasonActivationResult> {
  const payload = seasonActivationSchema.parse(input)
  const actor = id.parse(performedByAuthUserId)
  const { data, error } = await createAdminClient().rpc('activate_season_atomically', {
    p_activation_key: payload.activationId,
    p_source_season_id: payload.sourceSeasonId,
    p_target_season_id: payload.targetSeasonId,
    p_performed_by_auth_user_id: actor,
  })

  if (error) throw new Error('Impossibile attivare la stagione')
  return seasonActivationResultSchema.parse(data)
}
