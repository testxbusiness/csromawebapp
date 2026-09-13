import { z } from 'zod'

export const EARLY_ABSENCE_MAX_EVENT_IDS = 100
export const EARLY_ABSENCE_PAGE_SIZE = 100

// The limit applies to distinct IDs, so a retried payload containing duplicates
// does not fail merely because the client repeated an item.
const eventIdsSchema = z.array(z.string().uuid('ID evento non valido'))
  .transform((ids) => [...new Set(ids)])
  .refine((ids) => ids.length > 0, 'Selezionare almeno un evento')
  .refine((ids) => ids.length <= EARLY_ABSENCE_MAX_EVENT_IDS, `È possibile selezionare al massimo ${EARLY_ABSENCE_MAX_EVENT_IDS} eventi`)

export const earlyAbsenceMutationSchema = z.object({
  event_ids: eventIdsSchema,
  note: z.string().trim().max(1000).nullable().optional(),
}).strict()

export const earlyAbsencePeriodSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data iniziale non valida'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data finale non valida'),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(EARLY_ABSENCE_PAGE_SIZE).default(EARLY_ABSENCE_PAGE_SIZE),
}).superRefine((value, ctx) => {
  if (value.from > value.to) ctx.addIssue({ code: 'custom', path: ['to'], message: 'Periodo non valido' })
})

export type EarlyAbsenceMutation = z.infer<typeof earlyAbsenceMutationSchema>
