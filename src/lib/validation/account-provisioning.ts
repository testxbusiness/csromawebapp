import { z } from 'zod'

export const accountRoleSchema = z.enum(['admin', 'coach', 'staff', 'athlete', 'family_member'])

export const accountProvisioningSchema = z.object({
  email: z.string().trim().email('Email non valida').max(320),
  role: accountRoleSchema,
}).strict()

export type AccountProvisioningPayload = z.infer<typeof accountProvisioningSchema>
