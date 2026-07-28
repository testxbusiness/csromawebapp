import { z } from 'zod'

const isoDateTime = z.string().datetime({ offset: true })
const optionalUuid = z.string().uuid('ID non valido').optional().nullable()

const recurrenceRule = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  interval: z.number().int().min(1).max(365).optional(),
}).strict()

const eventFields = {
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  start_date: isoDateTime,
  end_date: isoDateTime,
  location: z.string().trim().max(300).optional().nullable(),
  gym_id: optionalUuid,
  activity_id: optionalUuid,
  event_type: z.enum(['one_time', 'recurring']),
  event_kind: z.enum(['training', 'match', 'meeting', 'other']).optional(),
  recurrence_rule: recurrenceRule.optional().nullable(),
  recurrence_end_date: isoDateTime.optional().nullable(),
  selected_teams: z.array(z.string().uuid('ID squadra non valido')).max(100).optional(),
  requires_confirmation: z.boolean().optional(),
  confirmation_deadline: isoDateTime.optional().nullable(),
}

export const eventCreateSchema = z.object(eventFields).strict()
export const eventUpdateSchema = z.object({ id: z.string().uuid('ID evento non valido'), ...eventFields }).strict()
