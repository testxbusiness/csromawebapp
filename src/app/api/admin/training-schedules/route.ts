import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'
import { reconcileTrainingSchedules } from '@/server/trainings/training-schedule-reconciliation'

const scheduleSchema = z.object({
  id: z.string().uuid().optional(),
  team_id: z.string().uuid(),
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  gym_id: z.string().uuid(),
  is_active: z.boolean().optional(),
})

const requestSchema = z.object({
  team_id: z.string().uuid(),
  schedules: z.array(scheduleSchema),
})

export async function POST(request: NextRequest) {
  try {
    const client = await createClient()
    const account = await requireGlobalRole(client, 'admin')
    const payload = requestSchema.safeParse(await request.json().catch(() => null))
    if (!payload.success || payload.data.schedules.some((schedule) => schedule.team_id !== payload.data.team_id)) {
      return NextResponse.json({ error: 'Dati degli orari non validi' }, { status: 400 })
    }

    const report = await reconcileTrainingSchedules(
      createAdminClient(),
      payload.data.team_id,
      payload.data.schedules,
      account.ownerProfileId,
    )
    return NextResponse.json(report, { status: report.success ? 200 : 500 })
  } catch (error) {
    if (error instanceof AccountContextError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: 'Impossibile riconciliare gli allenamenti' }, { status: 500 })
  }
}
