import { z } from 'zod'

const relationshipType = z.enum(['parent', 'guardian', 'caregiver', 'dependent', 'delegate'])
const relationshipStatus = z.enum(['pending', 'active', 'revoked'])
const optionalDate = z.preprocess(
  (value) => value === '' ? null : value,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida').nullable().optional()
)

export const relationshipCreateSchema = z.object({
  source_profile_id: z.string().uuid('Profilo sorgente non valido'),
  target_profile_id: z.string().uuid('Profilo target non valido'),
  relationship_type: relationshipType,
  status: relationshipStatus.default('pending'),
  valid_from: optionalDate,
  valid_until: optionalDate,
  can_view_schedule: z.boolean().default(false),
  can_confirm_attendance: z.boolean().default(false),
  can_view_payments: z.boolean().default(false),
  can_view_medical_status: z.boolean().default(false),
  can_view_documents: z.boolean().default(false),
  can_sign_documents: z.boolean().default(false),
  can_receive_messages: z.boolean().default(false),
  is_primary_contact: z.boolean().default(false),
  is_billing_contact: z.boolean().default(false),
  is_emergency_contact: z.boolean().default(false),
  verified: z.boolean().default(false),
}).strict()

export const relationshipUpdateSchema = relationshipCreateSchema.partial().omit({
  source_profile_id: true,
  target_profile_id: true,
}).extend({
  id: z.string().uuid('Relazione non valida'),
}).strict()

export type RelationshipCreatePayload = z.infer<typeof relationshipCreateSchema>
export type RelationshipUpdatePayload = z.infer<typeof relationshipUpdateSchema>
