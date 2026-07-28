import { z } from 'zod'

const passwordSchema = z.string().min(6, 'Password non valida').max(128, 'Password non valida')

export const loginPayloadSchema = z.object({
  email: z.string().trim().email('Email non valida'),
  password: passwordSchema,
}).strict()

export const resetPasswordPayloadSchema = z.object({
  password: passwordSchema,
}).strict()

export const adminResetPasswordPayloadSchema = z.object({
  user_id: z.string().uuid('ID utente non valido'),
}).strict()
