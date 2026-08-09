import { NextRequest, NextResponse } from 'next/server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'
import { getAccountActorSnapshot, recordAccountLifecycleAudit } from '@/server/audit/account-lifecycle'

type RouteContext = {
  params: Promise<{ id: string }>
}

async function recordAuditBestEffort(
  adminClient: ReturnType<typeof createAdminClient>,
  input: Parameters<typeof recordAccountLifecycleAudit>[1]
) {
  try {
    await recordAccountLifecycleAudit(adminClient, input)
  } catch (error) {
    console.error('Errore audit invito account:', error)
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const account = await requireGlobalRole(supabase, 'admin')
    const { id } = await context.params
    const adminClient = createAdminClient()

    const [{ data: profile, error: profileError }, { data: appAccount, error: accountError }] = await Promise.all([
      adminClient
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('id', id)
        .maybeSingle(),
      adminClient
        .from('app_accounts')
        .select('auth_user_id, owner_profile_id, status, must_change_password')
        .eq('owner_profile_id', id)
        .maybeSingle(),
    ])

    if (profileError || accountError) {
      return NextResponse.json({ error: 'Impossibile verificare persona e account' }, { status: 500 })
    }
    if (!profile) return NextResponse.json({ error: 'Persona non trovata' }, { status: 404 })
    if (!appAccount) return NextResponse.json({ error: 'La persona non ha ancora un account collegato' }, { status: 409 })
    if (appAccount.status !== 'invited') {
      return NextResponse.json({ error: 'L’account non è in attesa di invito' }, { status: 409 })
    }

    const { data: roleRow, error: roleError } = await adminClient
      .from('account_roles')
      .select('role')
      .eq('auth_user_id', appAccount.auth_user_id)
      .limit(1)
      .maybeSingle()

    if (roleError || !roleRow) {
      return NextResponse.json({ error: 'Mapping ruolo account non verificato' }, { status: 500 })
    }

    const { data: authData, error: authError } = await adminClient.auth.admin.getUserById(appAccount.auth_user_id)
    const email = authData.user?.email
    if (authError || !email) {
      return NextResponse.json({ error: 'Email account non disponibile' }, { status: 500 })
    }

    const actor = await getAccountActorSnapshot(adminClient, account.ownerProfileId)
    const redirectTo = new URL('/auth/callback', request.url).toString()
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        first_name: profile.first_name,
        last_name: profile.last_name,
      },
    })

    if (inviteError || !inviteData.user || inviteData.user.id !== appAccount.auth_user_id) {
      await recordAuditBestEffort(adminClient, {
        eventType: 'provisioning_failed',
        subjectProfileId: id,
        subjectAuthUserId: appAccount.auth_user_id,
        performedByAuthUserId: account.authUserId,
        performedByProfileId: account.ownerProfileId,
        ...actor,
        details: {
          stage: 'send_activation_email',
          provider: 'supabase_auth_smtp',
          reason: inviteError?.message || 'invite_user_mismatch',
        },
      })
      return NextResponse.json({ error: 'Supabase non ha accettato l’invio dell’invito' }, { status: 502 })
    }

    const { error: updateError } = await adminClient
      .from('app_accounts')
      .update({ invited_at: new Date().toISOString(), must_change_password: true })
      .eq('auth_user_id', appAccount.auth_user_id)

    if (updateError) {
      await recordAuditBestEffort(adminClient, {
        eventType: 'repair_required',
        subjectProfileId: id,
        subjectAuthUserId: appAccount.auth_user_id,
        performedByAuthUserId: account.authUserId,
        performedByProfileId: account.ownerProfileId,
        ...actor,
        details: { stage: 'update_invited_at', reason: 'account_update_failed' },
      })
      return NextResponse.json({ error: 'Email inviata ma aggiornamento stato fallito' }, { status: 500 })
    }

    await recordAccountLifecycleAudit(adminClient, {
      eventType: 'account_invited',
      subjectProfileId: id,
      subjectAuthUserId: appAccount.auth_user_id,
      performedByAuthUserId: account.authUserId,
      performedByProfileId: account.ownerProfileId,
      ...actor,
      details: { role: roleRow.role, email_sent: true, provider: 'supabase_auth_smtp' },
    })

    return NextResponse.json({ sent: true, email })
  } catch (error) {
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Errore invio invito account:', error)
    return NextResponse.json({ error: 'Errore interno durante l’invio dell’invito' }, { status: 500 })
  }
}
