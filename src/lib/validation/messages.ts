import { z } from 'zod'

const uuid = z.string().uuid('ID non valido')
const attachmentSchema = z.object({
  file_path: z.string().trim().min(1).max(500),
  file_name: z.string().trim().min(1).max(255),
  mime_type: z.string().trim().min(1).max(100),
  file_size: z.number().int().positive().max(10 * 1024 * 1024),
}).strict()

const messageFields = {
  subject: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(100_000),
  attachment_url: z.string().trim().max(1000).nullable().optional(),
  attachments: z.array(attachmentSchema).max(5).optional(),
  selected_teams: z.array(uuid).max(100).optional(),
  selected_users: z.array(uuid).max(500).optional(),
}

export const adminMessageCreateSchema = z.object(messageFields).strict()
export const adminMessageUpdateSchema = z.object({ id: uuid, ...messageFields }).strict()

export const coachMessageCreateSchema = z.object({
  subject: messageFields.subject,
  content: messageFields.content,
  attachment_url: messageFields.attachment_url,
  attachments: messageFields.attachments,
  selected_teams: messageFields.selected_teams,
}).strict()
export const coachMessageUpdateSchema = coachMessageCreateSchema.extend({ id: uuid }).strict()

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(500),
    auth: z.string().min(1).max(500),
  }).strict(),
  user_agent: z.string().max(1000).nullable().optional(),
  device_label: z.string().trim().max(200).nullable().optional(),
}).strict()

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url().max(2000),
}).strict()

export const pushTestSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  body: z.string().trim().min(1).max(500).optional(),
  url: z.string().trim().startsWith('/').max(500).optional(),
  icon: z.string().trim().startsWith('/').max(500).optional(),
  badge: z.string().trim().startsWith('/').max(500).optional(),
}).strict()
