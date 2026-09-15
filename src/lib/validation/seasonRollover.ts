import { z } from 'zod'

const uuid = z.string().uuid('Identificativo non valido')
const seasonDate = z.string().date('Data stagione non valida')
const nonEmptyName = z.string().trim().min(1).max(255)

export const rolloverSourceSeasonSchema = z.object({
  id: uuid,
  name: nonEmptyName,
  startDate: seasonDate,
  endDate: seasonDate,
}).strict()

export const rolloverTargetSeasonSchema = z.object({
  id: uuid,
  name: nonEmptyName,
  startDate: seasonDate,
  endDate: seasonDate,
  isActive: z.literal(false),
}).strict()

export const rolloverSeasonsSchema = z.object({
  source: rolloverSourceSeasonSchema,
  target: rolloverTargetSeasonSchema,
}).strict()

const targetReference = z.object({ targetId: uuid }).strict()

export const gymRolloverChoiceSchema = z.discriminatedUnion('choice', [
  z.object({ choice: z.literal('copy') }).strict(),
  z.object({ choice: z.literal('link'), ...targetReference.shape }).strict(),
  z.object({ choice: z.literal('skip') }).strict(),
])

export const activityRolloverChoiceSchema = z.discriminatedUnion('choice', [
  z.object({ choice: z.literal('copy') }).strict(),
  z.object({ choice: z.literal('link'), ...targetReference.shape }).strict(),
  z.object({ choice: z.literal('skip') }).strict(),
])

export const teamRolloverMappingSchema = z.discriminatedUnion('choice', [
  z.object({
    choice: z.literal('create_draft'),
    name: nonEmptyName,
    activityId: uuid,
    code: z.string().trim().min(1).max(50),
  }).strict(),
  z.object({ choice: z.literal('link'), targetTeamId: uuid }).strict(),
  z.object({ choice: z.literal('skip') }).strict(),
])

export const profileRolloverSelectionSchema = z.object({
  profileId: uuid,
  include: z.boolean(),
  targetTeamIds: z.array(uuid).max(100),
  memberships: z.array(z.object({
    targetTeamId: uuid,
    jerseyNumber: z.number().int().min(0).max(99).nullable().optional(),
    role: z.string().trim().min(1).max(80).nullable().optional(),
  }).strict()).max(100),
}).strict().superRefine((selection, context) => {
  const targetIds = new Set(selection.targetTeamIds)
  for (const membership of selection.memberships) {
    if (!targetIds.has(membership.targetTeamId)) {
      context.addIssue({ code: 'custom', path: ['memberships'], message: 'Membership non presente nelle squadre target selezionate' })
      break
    }
  }
})

export type RolloverSourceSeason = z.infer<typeof rolloverSourceSeasonSchema>
export type RolloverTargetSeason = z.infer<typeof rolloverTargetSeasonSchema>
export type RolloverSeasons = z.infer<typeof rolloverSeasonsSchema>
export type GymRolloverChoice = z.infer<typeof gymRolloverChoiceSchema>
export type ActivityRolloverChoice = z.infer<typeof activityRolloverChoiceSchema>
export type TeamRolloverMapping = z.infer<typeof teamRolloverMappingSchema>
export type ProfileRolloverSelection = z.infer<typeof profileRolloverSelectionSchema>
