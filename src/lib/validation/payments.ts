import { z } from 'zod'

const dateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida')
const optionalUuid = z.string().uuid('ID non valido').optional().nullable()

export const paymentCreateSchema = z.object({
  type: z.enum(['general_cost', 'coach_payment']),
  description: z.string().trim().min(1).max(500),
  amount: z.number().finite().min(0).max(10_000_000),
  frequency: z.enum(['one_time', 'recurring']),
  recurrence_pattern: z.string().trim().max(100).optional().nullable(),
  status: z.enum(['to_pay', 'pending', 'paid']).optional(),
  due_date: dateSchema.optional().nullable(),
  gym_id: optionalUuid,
  activity_id: optionalUuid,
  team_id: optionalUuid,
  coach_id: optionalUuid,
}).strict()

export const paymentPatchSchema = paymentCreateSchema.partial().extend({
  id: z.string().uuid('ID pagamento non valido'),
}).strict()
