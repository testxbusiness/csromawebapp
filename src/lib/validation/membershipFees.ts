import { z } from 'zod'

const uuid = z.string().uuid('ID non valido')
const money = z.coerce.number().finite().min(0).max(10_000_000)
const months = z.coerce.number().finite().min(0).max(120).multipleOf(0.5, 'La durata deve essere espressa in mesi interi o mezzi mesi')
const count = z.coerce.number().finite().int().min(0).max(120)
const date = z.string().date()
const installment = z.object({
  installment_number: z.coerce.number().int().min(1).max(120),
  due_date: date,
  amount: money,
}).strict()

export const membershipFeeSchema = z.object({
  season_id: uuid,
  team_id: uuid,
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  enrollment_fee: money,
  insurance_fee: money,
  monthly_fee: money,
  months_count: months,
  installments_count: z.coerce.number().int().min(1).max(120),
  installments: z.array(installment).max(120).optional(),
}).strict()

export const membershipFeeUpdateSchema = membershipFeeSchema.extend({ id: uuid }).strict()

export const membershipActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('generate_installments'), fee_id: uuid }).strict(),
  z.object({ action: z.literal('update_installment_status'), installment_id: uuid, status: z.literal('paid') }).strict(),
  z.object({ action: z.literal('reverse_installment_payment'), installment_id: uuid, reason: z.string().trim().min(5).max(500) }).strict(),
  z.object({ action: z.literal('recalculate_installment_statuses') }).strict(),
  z.object({ action: z.literal('bulk_update_installments'), installment_ids: z.array(uuid).min(1).max(1000), status: z.literal('paid') }).strict(),
  z.object({ action: z.literal('update_installment_details'), installment_id: uuid, due_date: date.optional(), amount: money.optional() }).strict().refine((v) => v.due_date !== undefined || v.amount !== undefined, { message: 'Nessun dato da aggiornare' }),
])
