import { z } from 'zod'

const uuid = z.string().uuid('ID non valido')
const ids = z.array(uuid).min(1).max(500)
const teamId = z.string().uuid('ID squadra non valido')

export const athleteBulkSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('assign_to_team'), athleteIds: ids, parameters: z.object({ teamId, jerseyNumber: z.string().regex(/^\d{1,2}$/).optional(), membershipFeeId: uuid.optional() }).strict(), dryRun: z.boolean().optional() }).strict(),
  z.object({ operation: z.literal('remove_from_team'), athleteIds: ids, parameters: z.object({ teamId }).strict(), dryRun: z.boolean().optional() }).strict(),
  z.object({ operation: z.literal('update_jersey'), athleteIds: ids, parameters: z.object({ teamId, jerseyNumber: z.string().regex(/^\d{1,2}$/) }).strict(), dryRun: z.boolean().optional() }).strict(),
  z.object({ operation: z.literal('update_medical_expiry'), athleteIds: ids, parameters: z.object({ expiryDate: z.union([z.string().date(), z.string().datetime({ offset: true })]) }).strict(), dryRun: z.boolean().optional() }).strict(),
])

const coachRole = z.enum(['head_coach', 'assistant_coach'])
export const coachBulkSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('assign_to_team'), coachIds: ids, parameters: z.object({ teamId: teamId.optional(), teamIds: z.array(teamId).min(1).max(100).optional(), role: coachRole.optional() }).strict(), dryRun: z.boolean().optional() }).strict(),
  z.object({ operation: z.literal('remove_from_team'), coachIds: ids, parameters: z.object({ teamId: teamId.optional(), teamIds: z.array(teamId).min(1).max(100).optional() }).strict(), dryRun: z.boolean().optional() }).strict(),
  z.object({ operation: z.literal('update_staff_role'), coachIds: ids, parameters: z.object({ role: coachRole }).strict(), dryRun: z.boolean().optional() }).strict(),
])

export const incassiPaymentSchema = z.object({
  installmentIds: ids,
  paymentDate: z.union([z.string().date(), z.string().datetime({ offset: true })]),
  paymentMethod: z.string().trim().min(1).max(80),
}).strict()
