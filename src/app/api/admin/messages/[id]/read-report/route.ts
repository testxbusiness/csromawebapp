import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'

const idSchema = z.string().uuid()

type ReportRecipient = {
  profile_id: string
  first_name: string
  last_name: string
  email: string | null
  source: 'direct' | 'team'
  teams: string[]
  auth_user_id: string | null
  read: boolean
  read_at: string | null
  read_by: 'account' | 'delegated' | null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    await requireGlobalRole(supabase, 'admin')
    const { id } = await params
    const messageId = idSchema.parse(id)
    const adminClient = createAdminClient()

    const { data: message, error: messageError } = await adminClient
      .from('messages')
      .select('id, subject')
      .eq('id', messageId)
      .maybeSingle()

    if (messageError) throw messageError
    if (!message) return NextResponse.json({ error: 'Messaggio non trovato' }, { status: 404 })

    const { data: recipientRows, error: recipientError } = await adminClient
      .from('message_recipients')
      .select('recipient_type, team_id, profile_id')
      .eq('message_id', messageId)

    if (recipientError) throw recipientError

    const teamIds = [...new Set((recipientRows ?? []).map((row) => row.team_id).filter(Boolean))]
    const directProfileIds = new Set(
      (recipientRows ?? []).map((row) => row.profile_id).filter(Boolean),
    )
    const teamNames = new Map<string, string>()
    const teamProfileIds = new Set<string>()

    if (teamIds.length > 0) {
      const [{ data: teams }, { data: members }, { data: coaches }] = await Promise.all([
        adminClient.from('teams').select('id, name').in('id', teamIds),
        adminClient.from('team_members').select('profile_id, team_id').in('team_id', teamIds),
        adminClient.from('team_coaches').select('coach_id, team_id').in('team_id', teamIds),
      ])

      for (const team of teams ?? []) teamNames.set(team.id, team.name)
      for (const member of members ?? []) if (member.profile_id) teamProfileIds.add(member.profile_id)
      for (const coach of coaches ?? []) if (coach.coach_id) teamProfileIds.add(coach.coach_id)
    }

    const profileIds = [...new Set([...directProfileIds, ...teamProfileIds])]
    const [{ data: profiles }, { data: accounts }, { data: reads }] = await Promise.all([
      profileIds.length > 0
        ? adminClient.from('profiles').select('id, first_name, last_name, email').in('id', profileIds)
        : Promise.resolve({ data: [] }),
      profileIds.length > 0
        ? adminClient.from('app_accounts').select('owner_profile_id, auth_user_id').in('owner_profile_id', profileIds)
        : Promise.resolve({ data: [] }),
      adminClient.from('message_reads').select('auth_user_id, subject_profile_id, read_at').eq('message_id', messageId),
    ])

    const accountByProfile = new Map((accounts ?? []).map((account) => [account.owner_profile_id, account.auth_user_id]))
    const teamNamesByProfile = new Map<string, Set<string>>()
    for (const row of recipientRows ?? []) {
      if (!row.profile_id || !row.team_id) continue
      const names = teamNamesByProfile.get(row.profile_id) ?? new Set<string>()
      const name = teamNames.get(row.team_id)
      if (name) names.add(name)
      teamNamesByProfile.set(row.profile_id, names)
    }

    const reportRecipients: ReportRecipient[] = (profiles ?? []).map((profile) => {
      const authUserId = accountByProfile.get(profile.id) ?? null
      const subjectReads = (reads ?? []).filter((read) => read.subject_profile_id === profile.id)
      const ownRead = authUserId
        ? subjectReads.find((read) => read.auth_user_id === authUserId)
        : undefined
      const delegatedRead = subjectReads.find((read) => read.auth_user_id !== authUserId)
      const read = ownRead ?? delegatedRead
      return {
        profile_id: profile.id,
        first_name: profile.first_name ?? '',
        last_name: profile.last_name ?? '',
        email: profile.email ?? null,
        source: directProfileIds.has(profile.id) ? ('direct' as const) : ('team' as const),
        teams: [...(teamNamesByProfile.get(profile.id) ?? [])],
        auth_user_id: authUserId,
        read: Boolean(read),
        read_at: read?.read_at ?? null,
        read_by: ownRead ? ('account' as const) : delegatedRead ? ('delegated' as const) : null,
      }
    }).sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`))

    const delegatedReads = (reads ?? []).filter((read) => {
      return !reportRecipients.some((recipient) => (
        recipient.auth_user_id === read.auth_user_id && recipient.profile_id === read.subject_profile_id
      ))
    }).length

    return NextResponse.json({
      message,
      summary: {
        tracked_recipient_count: reportRecipients.length,
        read_count: reportRecipients.filter((recipient) => recipient.read).length,
        unread_count: reportRecipients.filter((recipient) => !recipient.read).length,
        delegated_read_count: delegatedReads,
      },
      recipients: reportRecipients,
    })
  } catch (error) {
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'ID messaggio non valido' }, { status: 400 })
    }
    console.error('Admin message read report error:', error)
    return NextResponse.json({ error: 'Impossibile caricare il report letture' }, { status: 500 })
  }
}
