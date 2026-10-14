import { NextRequest, NextResponse } from 'next/server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'
import { getAccountActorSnapshot, recordAccountLifecycleAudit } from '@/server/audit/account-lifecycle'

type RouteContext = { params: Promise<{ profileId: string; membershipFeeId: string }> }

const PAYMENT_BLOCK_MESSAGE = 'Questa quota contiene rate già registrate come pagate e non può essere rimossa automaticamente. È necessaria una rettifica amministrativa.'

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const account = await requireGlobalRole(supabase, 'admin')
    const adminClient = createAdminClient()
    const { profileId, membershipFeeId } = await context.params

    const [{ data: profile, error: profileError }, { data: fee, error: feeError }] = await Promise.all([
      adminClient.from('profiles').select('id').eq('id', profileId).maybeSingle(),
      adminClient.from('membership_fees').select('id, name, team_id').eq('id', membershipFeeId).maybeSingle(),
    ])

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Atleta non trovato' }, { status: 404 })
    }
    if (feeError || !fee) {
      return NextResponse.json({ error: 'Quota non trovata' }, { status: 404 })
    }

    // Load every installment before deleting anything. Payment metadata is checked
    // in addition to status because legacy rows can be internally inconsistent.
    const { data: installments, error: installmentsError } = await adminClient
      .from('fee_installments')
      .select('id, status, paid_at, paid_by_auth_user_id, payment_source')
      .eq('profile_id', profileId)
      .eq('membership_fee_id', membershipFeeId)

    if (installmentsError) {
      console.error('Errore caricamento rate prima della rimozione quota atleta:', installmentsError)
      return NextResponse.json({ error: 'Impossibile verificare lo stato delle rate' }, { status: 500 })
    }

    const rows = installments ?? []
    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        profile_id: profileId,
        membership_fee_id: membershipFeeId,
        deleted_installments: 0,
        result: 'already_removed',
      })
    }

    const hasPaymentEvidence = rows.some((installment) => (
      installment.status === 'paid'
      || installment.status === 'partially_paid'
      || installment.paid_at != null
      || installment.paid_by_auth_user_id != null
      || installment.payment_source != null
    ))

    if (hasPaymentEvidence) {
      return NextResponse.json({ error: PAYMENT_BLOCK_MESSAGE, code: 'PAID_INSTALLMENTS_BLOCK_REMOVAL' }, { status: 409 })
    }

    const { error: deleteError } = await adminClient
      .from('fee_installments')
      .delete()
      .eq('profile_id', profileId)
      .eq('membership_fee_id', membershipFeeId)

    if (deleteError) {
      console.error('Errore rimozione quota da atleta:', deleteError)
      return NextResponse.json({ error: 'Errore durante la rimozione della quota dall’atleta' }, { status: 500 })
    }

    try {
      const actor = await getAccountActorSnapshot(adminClient, account.ownerProfileId)
      await recordAccountLifecycleAudit(adminClient, {
        eventType: 'repair_required',
        subjectProfileId: profileId,
        performedByAuthUserId: account.authUserId,
        performedByProfileId: account.ownerProfileId,
        ...actor,
        details: {
          action: 'athlete_fee_removed',
          profile_id: profileId,
          membership_fee_id: membershipFeeId,
          team_id: fee.team_id,
          deleted_installments: rows.length,
        },
      })
    } catch (auditError) {
      // The removal already succeeded; an audit outage must not cause a retry
      // that could mislead the operator into repeating the destructive action.
      console.error('Errore audit rimozione quota da atleta:', auditError)
    }

    return NextResponse.json({
      success: true,
      profile_id: profileId,
      membership_fee_id: membershipFeeId,
      deleted_installments: rows.length,
      result: 'removed',
    })
  } catch (error) {
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Errore API rimozione quota da atleta:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
