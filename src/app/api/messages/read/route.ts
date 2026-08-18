import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { messageReadSchema } from '@/lib/validation/messages'
import { AccountContextError, requireAccountContext } from '@/server/auth/require-account-context'
import { requireSubjectAthleteContext } from '@/server/auth/require-subject-profile'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const account = await requireAccountContext(supabase)
    const parsed = messageReadSchema.safeParse(await request.json().catch(() => null))

    if (!parsed.success) {
      return NextResponse.json({ error: 'Lettura non valida' }, { status: 400 })
    }

    const subjectProfileId = parsed.data.subject_profile_id ?? account.ownerProfileId
    if (subjectProfileId !== account.ownerProfileId) {
      await requireSubjectAthleteContext(supabase, subjectProfileId, 'receive_messages')
    }

    const { error } = await supabase
      .from('message_reads')
      .upsert({
        message_id: parsed.data.message_id,
        auth_user_id: account.authUserId,
        subject_profile_id: subjectProfileId,
        read_at: new Date().toISOString(),
      }, { onConflict: 'message_id,auth_user_id,subject_profile_id' })

    if (error) {
      console.error('Message read error:', error)
      return NextResponse.json({ error: 'Messaggio non accessibile' }, { status: 403 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Message read API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
