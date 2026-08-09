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

const optionalNullableUuid = z.preprocess(
  (value) => value === '' ? null : value,
  z.string().uuid('Identificativo non valido').nullable().optional()
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
  team_id: optionalNullableUuid,
  jersey_number: z.number().int().min(0).max(99).nullable().optional(),
  membership_number: optionalNullableText(80),
  medical_certificate_expiry: optionalNullableDate,
  personal_notes: optionalNullableText(2000),
}).strict()

export type AthleteCreatePayload = z.infer<typeof athleteCreateSchema>

export const athleteUpdateSchema = athleteCreateSchema.partial().extend({
  id: z.string().uuid('Atleta non valido'),
  season_id: z.string().uuid('Stagione non valida'),
}).strict()

const optionalNullableImportText = (max: number) =>
  z.preprocess(
    (value) => value === '' ? null : value,
    z.string().trim().max(max).nullable().optional()
  )

const optionalNullableImportDate = z.preprocess(
  (value) => value === '' ? null : value,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida').nullable().optional()
)

export const athleteImportRowSchema = z.object({
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  membership_number: z.string().trim().min(1).max(80),
  email: optionalNullableImportText(320),
  phone: optionalNullableImportText(40),
  birth_date: optionalNullableImportDate,
  medical_certificate_expiry: optionalNullableImportDate,
  personal_notes: optionalNullableImportText(2000),
  activity_name: optionalNullableImportText(160),
  team_code: optionalNullableImportText(120),
  jersey_number: z.preprocess(
    (value) => value === '' || value === null || value === undefined ? null : Number(value),
    z.number().int().min(0).max(99).nullable().optional()
  ),
}).strict()

export const athleteImportSchema = z.object({
  season_id: z.string().uuid('Stagione non valida'),
  rows: z.array(athleteImportRowSchema).min(1).max(1000),
  dry_run: z.boolean().optional(),
}).strict()

export type AthleteImportRow = z.infer<typeof athleteImportRowSchema>

export const collaboratorTypeSchema = z.enum(['coach', 'staff', 'admin'])
export const collaboratorCreateSchema = profileCreateSchema.extend({
  collaborator_type: collaboratorTypeSchema,
  season_id: z.string().uuid('Stagione non valida'),
  level: optionalNullableText(120),
  specialization: optionalNullableText(240),
  started_on: optionalNullableDate,
  team_id: optionalNullableUuid,
  team_role: z.enum(['head_coach', 'assistant_coach']).nullable().optional(),
}).strict()

export const collaboratorUpdateSchema = collaboratorCreateSchema.partial().extend({
  id: z.string().uuid('Collaboratore non valido'),
  season_id: z.string().uuid('Stagione non valida'),
}).strict()

export type CollaboratorCreatePayload = z.infer<typeof collaboratorCreateSchema>
