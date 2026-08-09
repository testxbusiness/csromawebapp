import { NextRequest, NextResponse } from 'next/server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { accountProvisioningSchema } from '@/lib/validation/account-provisioning'
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
    console.error('Errore audit provisioning account:', error)
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  let authUserId: string | null = null
  let ownerProfileId: string | null = null
  let actor: Awaited<ReturnType<typeof getAccountActorSnapshot>> = {
    performedByEmail: null,
    performedByFirstName: null,
    performedByLastName: null,
  }

  try {
    const supabase = await createClient()
    const account = await requireGlobalRole(supabase, 'admin')
    const { id } = await context.params
    ownerProfileId = id
    const parsed = accountProvisioningSchema.safeParse(await request.json().catch(() => null))

    if (!parsed.success) {
      return NextResponse.json({ error: 'Dati account non validi' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, email, first_name, last_name')
      .eq('id', id)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json({ error: 'Impossibile verificare la persona' }, { status: 500 })
    }
    if (!profile) {
      return NextResponse.json({ error: 'Persona non trovata' }, { status: 404 })
    }

    const { data: existingAccount, error: existingAccountError } = await adminClient
      .from('app_accounts')
      .select('auth_user_id, status')
      .eq('owner_profile_id', id)
      .maybeSingle()

    if (existingAccountError) {
      return NextResponse.json({ error: 'Impossibile verificare l’account esistente' }, { status: 500 })
    }
    if (existingAccount) {
      return NextResponse.json({ error: 'La persona ha già un account collegato' }, { status: 409 })
    }

    actor = await getAccountActorSnapshot(adminClient, account.ownerProfileId)
    await recordAccountLifecycleAudit(adminClient, {
      eventType: 'account_provisioning_started',
      subjectProfileId: id,
      performedByAuthUserId: account.authUserId,
      performedByProfileId: account.ownerProfileId,
      ...actor,
      details: { role: parsed.data.role, email: parsed.data.email },
    })

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: parsed.data.email,
      email_confirm: false,
      user_metadata: {
        first_name: profile.first_name,
        last_name: profile.last_name,
      },
    })

    if (authError || !authData.user) {
      const duplicateEmail = authError?.code === 'email_exists' || authError?.message.toLowerCase().includes('already')
      await recordAuditBestEffort(adminClient, {
        eventType: 'provisioning_failed',
        subjectProfileId: id,
        performedByAuthUserId: account.authUserId,
        performedByProfileId: account.ownerProfileId,
        ...actor,
        details: { stage: 'auth_create', reason: duplicateEmail ? 'email_exists' : 'auth_create_failed' },
      })
      return NextResponse.json({
        error: duplicateEmail
          ? 'Esiste già un account Auth con questa email. Non è stato effettuato alcun collegamento automatico.'
          : 'Impossibile creare l’account Auth',
      }, { status: duplicateEmail ? 409 : 400 })
    }

    authUserId = authData.user.id
    await recordAuditBestEffort(adminClient, {
      eventType: 'account_created',
      subjectProfileId: id,
      subjectAuthUserId: authUserId,
      performedByAuthUserId: account.authUserId,
      performedByProfileId: account.ownerProfileId,
      ...actor,
      details: { email: parsed.data.email, access_sent: false },
    })

    const { data: mapping, error: mappingError } = await adminClient.rpc('provision_account_mapping', {
      p_auth_user_id: authUserId,
      p_owner_profile_id: id,
      p_role: parsed.data.role,
    })

    if (mappingError || !mapping?.length) {
      await recordAuditBestEffort(adminClient, {
        eventType: 'provisioning_failed',
        subjectProfileId: id,
        subjectAuthUserId: authUserId,
        performedByAuthUserId: account.authUserId,
        performedByProfileId: account.ownerProfileId,
        ...actor,
        details: { stage: 'account_mapping', reason: 'mapping_failed' },
      })
      const cleanup = await adminClient.auth.admin.deleteUser(authUserId)
      if (cleanup.error) {
        await recordAuditBestEffort(adminClient, {
          eventType: 'repair_required',
          subjectProfileId: id,
          subjectAuthUserId: authUserId,
          performedByAuthUserId: account.authUserId,
          performedByProfileId: account.ownerProfileId,
          ...actor,
          details: { stage: 'auth_cleanup', reason: cleanup.error.message },
        })
      }
      return NextResponse.json({ error: 'Impossibile completare il mapping dell’account' }, { status: 500 })
    }

    const [{ data: verifiedAccount }, { data: verifiedRole }] = await Promise.all([
      adminClient
        .from('app_accounts')
        .select('auth_user_id, owner_profile_id, status, must_change_password')
        .eq('auth_user_id', authUserId)
        .maybeSingle(),
      adminClient
        .from('account_roles')
        .select('role')
        .eq('auth_user_id', authUserId)
        .eq('role', parsed.data.role)
        .maybeSingle(),
    ])

    if (!verifiedAccount || verifiedAccount.owner_profile_id !== id || !verifiedRole) {
      await recordAuditBestEffort(adminClient, {
        eventType: 'provisioning_failed',
        subjectProfileId: id,
        subjectAuthUserId: authUserId,
        performedByAuthUserId: account.authUserId,
        performedByProfileId: account.ownerProfileId,
        ...actor,
        details: { stage: 'mapping_verification', reason: 'verification_failed' },
      })
      await adminClient.auth.admin.deleteUser(authUserId)
      return NextResponse.json({ error: 'Verifica mapping account fallita' }, { status: 500 })
    }

    await recordAccountLifecycleAudit(adminClient, {
      eventType: 'mapping_verified',
      subjectProfileId: id,
      subjectAuthUserId: authUserId,
      performedByAuthUserId: account.authUserId,
      performedByProfileId: account.ownerProfileId,
      ...actor,
      details: { role: parsed.data.role, access_sent: false },
    })

    return NextResponse.json({
      profile: profile,
      account: {
        auth_user_id: authUserId,
        owner_profile_id: id,
        status: verifiedAccount.status,
        role: verifiedRole.role,
        must_change_password: verifiedAccount.must_change_password,
        access_sent: false,
      },
    }, { status: 201 })
  } catch (error) {
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Errore provisioning account:', error)
    return NextResponse.json({ error: 'Errore interno durante la creazione account' }, { status: 500 })
  }
}
