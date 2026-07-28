import { z } from 'zod'

const uuid = z.string().uuid('ID non valido')
const documentType = z.enum([
  'medical_request',
  'enrollment_form',
  'attendance_certificate',
  'payment_receipt',
  'team_convocation',
])

const templateFields = {
  name: z.string().trim().min(1).max(255),
  target_type: z.enum(['user', 'team']),
  type: documentType,
  logo_position: z.enum(['top-left', 'top-center', 'top-right']),
  has_logo: z.boolean(),
  content_html: z.string().min(1).max(500_000),
}

export const documentTemplateCreateSchema = z.object(templateFields).strict()
export const documentTemplateUpdateSchema = documentTemplateCreateSchema.extend({ id: uuid }).strict()

export const generatedDocumentSchema = z.object({
  name: z.string().trim().min(1).max(255),
  title: z.string().trim().min(1).max(255),
  type: documentType,
  template_id: uuid.nullable().optional(),
  profile_id: uuid.nullable().optional(),
  team_id: uuid.nullable().optional(),
  document_type: documentType,
  status: z.literal('generated'),
  generated_content_html: z.string().min(1).max(500_000),
  target_user_id: uuid.nullable().optional(),
  target_team_id: uuid.nullable().optional(),
  generation_date: z.string().datetime({ offset: true }).optional(),
}).strict()
