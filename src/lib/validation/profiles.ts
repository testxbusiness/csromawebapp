import { z } from 'zod'

const optionalNullableText = (max: number) =>
  z.preprocess(
    (value) => value === '' ? null : value,
    z.string().trim().max(max).nullable().optional()
  )

const optionalNullableDate = z.preprocess(
  (value) => value === '' ? null : value,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida').nullable().optional()
)

export const profileCreateSchema = z.object({
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  email: z.preprocess(
    (value) => value === '' ? null : value,
    z.string().trim().email('Email non valida').max(320).nullable().optional()
  ),
  phone: optionalNullableText(40),
  birth_date: optionalNullableDate,
}).strict()

export type ProfileCreatePayload = z.infer<typeof profileCreateSchema>

export const athleteCreateSchema = profileCreateSchema.extend({
  season_id: z.string().uuid('Stagione non valida'),
  membership_number: optionalNullableText(80),
  medical_certificate_expiry: optionalNullableDate,
  personal_notes: optionalNullableText(2000),
}).strict()

export type AthleteCreatePayload = z.infer<typeof athleteCreateSchema>
