import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireSubjectAthleteContext } from '@/server/auth/require-subject-profile'
import { noStoreJson } from '@/server/http/no-store'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const subject = await requireSubjectAthleteContext(supabase, searchParams.get('subjectProfileId'), 'receive_messages')
    const { data: memberships, error: membershipError } = await subject.dataClient
      .from('team_members')
      .select('team_id')
      .eq('profile_id', subject.profileId)
    if (membershipError) return noStoreJson({ error: 'Allegato non accessibile' }, 404)
    const teamIds = memberships?.map((membership) => membership.team_id).filter(Boolean) ?? []
    const recipientFilters = [`profile_id.eq.${subject.profileId}`]
    if (teamIds.length > 0) recipientFilters.push(`team_id.in.(${teamIds.join(',')})`)
    const { data: accessibleRecipients, error: recipientError } = await subject.dataClient
      .from('message_recipients')
      .select('message_id')
      .or(recipientFilters.join(','))
    if (recipientError) return noStoreJson({ error: 'Allegato non accessibile' }, 404)
    const accessibleMessageIds = [...new Set((accessibleRecipients || []).map((recipient) => recipient.message_id))]

    const { data: attachment, error: attachmentError } = await adminClient
      .from('message_attachments')
      .select('id, message_id, file_path, file_name, mime_type, file_size')
      .eq('id', id)
      .maybeSingle()
    if (attachmentError || !attachment || !accessibleMessageIds.includes(attachment.message_id)) {
      return noStoreJson({ error: 'Allegato non accessibile' }, 404)
    }

    const { data: signed, error: signedError } = await adminClient
      // @ts-ignore: storage polyfill types
      .storage.from('message-attachments')
      .createSignedUrl(attachment.file_path, 300)
    if (signedError || !signed?.signedUrl) return noStoreJson({ error: 'Allegato non disponibile' }, 404)
    return noStoreJson({
      attachment: {
        id: attachment.id,
        file_name: attachment.file_name,
        mime_type: attachment.mime_type,
        file_size: attachment.file_size,
        download_url: signed.signedUrl,
      },
    })
  } catch (error) {
    if (error instanceof AccountContextError) return noStoreJson({ error: error.message }, error.status)
    console.error('Athlete attachment API error:', error)
    return noStoreJson({ error: 'Allegato non accessibile' }, 404)
  }
}
