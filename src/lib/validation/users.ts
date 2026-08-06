import { z } from 'zod'

const roleSchema = z.enum(['admin', 'coach', 'athlete'])
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional()
const optionalDate = z.string().trim().regex(/^$|^\d{4}-\d{2}-\d{2}$/, 'Data non valida').nullable().optional()

const athleteProfileSchema = z.object({
  membership_number: optionalText(80),
  medical_certificate_expiry: optionalDate,
  personal_notes: optionalText(2000),
}).strict().nullable().optional()

const coachProfileSchema = z.object({
  level: optionalText(80),
  specialization: optionalText(160),
  started_on: optionalDate,
}).strict().nullable().optional()

const teamAssignmentSchema = z.object({
  team_id: z.string().uuid('ID squadra non valido'),
  jersey_number: z.number().int().min(0).max(99).nullable().optional(),
}).strict()

export const userPayloadSchema = z.object({
  email: z.string().trim().email('Email non valida'),
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  role: roleSchema,
  phone: optionalText(40),
  birth_date: optionalDate,
  team_ids: z.array(z.string().uuid('ID squadra non valido')).max(50).optional(),
  team_assignments: z.array(teamAssignmentSchema).max(50).optional(),
  athlete_profile: athleteProfileSchema,
  coach_profile: coachProfileSchema,
  membership_number: optionalText(80),
  medical_certificate_expiry: optionalDate,
  personal_notes: optionalText(2000),
  coach_level: optionalText(80),
  coach_specialization: optionalText(160),
  coach_started_on: optionalDate,
}).strict()

export const userPatchPayloadSchema = z.discriminatedUnion('action', [
  z.object({
    userId: z.string().uuid('ID utente non valido'),
    action: z.literal('toggle_active'),
  }).strict(),
  z.object({
    userId: z.string().uuid('ID utente non valido'),
    action: z.literal('update_roles'),
    roles: z.array(roleSchema).max(3),
  }).strict(),
])

export const importedUsersPayloadSchema = z.object({
  users: z.array(z.object({
    first_name: z.string().trim().min(1).max(100),
    last_name: z.string().trim().min(1).max(100),
    email: z.string().trim().email('Email non valida'),
    phone_number: optionalText(40),
    date_of_birth: optionalDate,
    role: roleSchema,
  }).strict()).min(1).max(500),
}).strict()
