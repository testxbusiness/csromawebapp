import { z } from 'zod'

const uuid = z.string().uuid('ID non valido')
const money = z.coerce.number().finite().min(0).max(10_000_000)
const count = z.coerce.number().finite().int().min(0).max(120)
const date = z.string().date()
const installment = z.object({
  installment_number: z.coerce.number().int().min(1).max(120),
  due_date: date,
  amount: money,
}).strict()

export const membershipFeeSchema = z.object({
  team_id: uuid,
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  enrollment_fee: money,
  insurance_fee: money,
  monthly_fee: money,
  months_count: count,
  installments_count: z.coerce.number().int().min(1).max(120),
  installments: z.array(installment).max(120).optional(),
}).strict()

export const membershipFeeUpdateSchema = membershipFeeSchema.extend({ id: uuid }).strict()

const installmentStatus = z.enum(['not_due', 'due_soon', 'overdue', 'paid'])
export const membershipActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('generate_installments'), fee_id: uuid }).strict(),
  z.object({ action: z.literal('update_installment_status'), installment_id: uuid, status: installmentStatus, paid_at: z.string().datetime({ offset: true }).optional().nullable() }).strict(),
  z.object({ action: z.literal('recalculate_installment_statuses') }).strict(),
  z.object({ action: z.literal('bulk_update_installments'), installment_ids: z.array(uuid).min(1).max(1000), status: installmentStatus }).strict(),
  z.object({ action: z.literal('update_installment_details'), installment_id: uuid, due_date: date.optional(), amount: money.optional() }).strict().refine((v) => v.due_date !== undefined || v.amount !== undefined, { message: 'Nessun dato da aggiornare' }),
])
