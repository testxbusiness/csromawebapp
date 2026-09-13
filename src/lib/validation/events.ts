import { z } from 'zod'

export const athleteAttendanceSchema = z.object({
  event_id: z.string().uuid('ID evento non valido'),
  status: z.enum(['going', 'maybe', 'declined']),
  note: z.string().trim().max(1000).nullable().optional(),
}).strict()

export type AthleteAttendanceStatus = z.infer<typeof athleteAttendanceSchema>['status']

export const eventIdQuerySchema = z.object({
  event_id: z.string().uuid('ID evento non valido'),
})
