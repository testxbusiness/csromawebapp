import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { membershipActionSchema, membershipFeeSchema, membershipFeeUpdateSchema } from '@/lib/validation/membershipFees'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'
import { getAccountActorSnapshot, recordAccountLifecycleAudit } from '@/server/audit/account-lifecycle'
import { getUnpaidInstallmentStatus } from '@/server/admin/fee-installment-status'

async function teamBelongsToSeason(adminClient: ReturnType<typeof createAdminClient>, teamId: string, seasonId: string) {
  const { data: team } = await adminClient.from('teams').select('activity_id').eq('id', teamId).maybeSingle()
  if (!team) return false
  const { data: activity } = await adminClient.from('activities').select('season_id').eq('id', team.activity_id).maybeSingle()
  return activity?.season_id === seasonId
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const account = await requireGlobalRole(supabase, 'admin')
    const adminClient = createAdminClient()
    const parsed = membershipFeeSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Dati quota associativa non validi' }, { status: 400 })
    const { season_id, team_id, name, description, enrollment_fee, insurance_fee, monthly_fee, months_count, installments_count, installments } = parsed.data
    if (!(await teamBelongsToSeason(adminClient, team_id, season_id))) {
      return NextResponse.json({ error: 'La squadra non appartiene alla stagione selezionata' }, { status: 400 })
    }

    // Calcola importo totale
    const total_amount = (Number(enrollment_fee) || 0) +
                        (Number(insurance_fee) || 0) +
                        ((Number(monthly_fee) || 0) * (Number(months_count) || 0))

    // Crea la quota associativa
    const { data: fee, error: feeError } = await adminClient
      .from('membership_fees')
      .insert({
        team_id,
        name,
        description: description || null,
        total_amount,
        enrollment_fee: Number(enrollment_fee) || 0,
        insurance_fee: Number(insurance_fee) || 0,
        monthly_fee: Number(monthly_fee) || 0,
        months_count: Number(months_count) || 0,
        installments_count: Number(installments_count) || 1,
        created_by: account.ownerProfileId
      })
      .select('id')
      .single()

    if (feeError || !fee) {
      console.error('Errore creazione quota associativa:', feeError)
      return NextResponse.json({ error: 'Errore creazione quota associativa' }, { status: 400 })
    }

    // Crea le rate predefinite se specificate
    if (installments && Array.isArray(installments) && installments.length > 0) {
      try {
        // Crea le rate predefinite (template)
        const predefinedInstallmentsToCreate = installments.map(installment => ({
          membership_fee_id: fee.id,
          installment_number: installment.installment_number,
          due_date: installment.due_date,
          amount: installment.amount
        }))

        if (predefinedInstallmentsToCreate.length > 0) {
          const { error: predefinedError } = await adminClient
            .from('predefined_installments')
            .insert(predefinedInstallmentsToCreate)

          if (predefinedError) {
            console.error('Errore creazione rate predefinite:', predefinedError)
            // Non ritorniamo errore perché la quota è stata creata comunque
          }
        }
      } catch (installmentsError) {
        console.error('Errore durante creazione rate predefinite:', installmentsError)
        // Non ritorniamo errore perché la quota è stata creata comunque
      }
    }

    return NextResponse.json({ 
      success: true, 
      fee_id: fee.id,
      message: 'Quota associativa creata con successo'
    })

  } catch (error) {
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Errore API creazione quota associativa:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    await requireGlobalRole(supabase, 'admin')
    const adminClient = createAdminClient()
    
    const seasonId = new URL(request.url).searchParams.get('season_id')

    // Prima ottieni solo le quote base
    const { data: feesData, error } = await adminClient
      .from('membership_fees')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    let feesForSeason = feesData || []
    if (seasonId) {
      const teamIds = [...new Set(feesForSeason.map((fee) => fee.team_id))]
      const { data: teams } = teamIds.length
        ? await adminClient.from('teams').select('id, activity_id').in('id', teamIds)
        : { data: [] as { id: string; activity_id: string }[] }
      const activityIds = [...new Set((teams || []).map((team) => team.activity_id))]
      const { data: activities } = activityIds.length
        ? await adminClient.from('activities').select('id, season_id').in('id', activityIds)
        : { data: [] as { id: string; season_id: string }[] }
      const seasonByActivityId = new Map((activities || []).map((activity) => [activity.id, activity.season_id]))
      const seasonByTeamId = new Map((teams || []).map((team) => [team.id, seasonByActivityId.get(team.activity_id)]))
      feesForSeason = feesForSeason.filter((fee) => seasonByTeamId.get(fee.team_id) === seasonId)
    }

    // Ora arricchisci con i dati correlati
    const enrichedFees = await Promise.all(
      feesForSeason.map(async (fee) => {
        const enrichedFee = { ...fee }

        // Ottieni dati squadra
        if (fee.team_id) {
          const { data: teamData } = await adminClient
            .from('teams')
            .select('id, name, code, activity_id')
            .eq('id', fee.team_id)
            .single()
          
          if (teamData) {
            enrichedFee.teams = teamData
            const { data: activityData } = await adminClient
              .from('activities')
              .select('season_id')
              .eq('id', teamData.activity_id)
              .maybeSingle()
            enrichedFee.season_id = activityData?.season_id
          }
        }

        // Ottieni dati creatore
        if (fee.created_by) {
          const { data: profileData } = await adminClient
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', fee.created_by)
            .single()
          
          if (profileData) {
            enrichedFee.created_by_profile = profileData
          }
        }

        // Ottieni rate predefinite
        const { data: predefinedInstallments } = await adminClient
          .from('predefined_installments')
          .select('id, installment_number, due_date, amount, description')
          .eq('membership_fee_id', fee.id)
          .order('installment_number')

        if (predefinedInstallments && predefinedInstallments.length > 0) {
          enrichedFee.predefined_installments = predefinedInstallments
        }

        // Ottieni rate assegnate agli atleti
        const { data: installments } = await adminClient
          .from('fee_installments')
          .select('id, profile_id, installment_number, due_date, amount, status, paid_at')
          .eq('membership_fee_id', fee.id)

        if (installments && installments.length > 0) {
          enrichedFee.fee_installments = []

          for (const installment of installments) {
            const installmentData: any = { ...installment }

            if (installment.profile_id) {
              const { data: profileData } = await adminClient
                .from('profiles')
                .select('first_name, last_name')
                .eq('id', installment.profile_id)
                .single()

              if (profileData) {
                installmentData.profiles = profileData
              }
            }

            enrichedFee.fee_installments.push(installmentData)
          }
        }

        return enrichedFee
      })
    )

    return NextResponse.json({ fees: enrichedFees })

  } catch (error) {
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Errore API lista quote associative:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    await requireGlobalRole(supabase, 'admin')
    const adminClient = createAdminClient()
    const parsed = membershipFeeUpdateSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Dati aggiornamento quota non validi' }, { status: 400 })
    const { id, season_id, team_id, name, description, enrollment_fee, insurance_fee, monthly_fee, months_count, installments_count, installments } = parsed.data
    if (!(await teamBelongsToSeason(adminClient, team_id, season_id))) {
      return NextResponse.json({ error: 'La squadra non appartiene alla stagione selezionata' }, { status: 400 })
    }

    // Calcola importo totale
    const total_amount = (Number(enrollment_fee) || 0) +
                        (Number(insurance_fee) || 0) +
                        ((Number(monthly_fee) || 0) * (Number(months_count) || 0))

    // Aggiorna la quota associativa
    const { error: feeError } = await adminClient
      .from('membership_fees')
      .update({
        team_id,
        name,
        description: description || null,
        total_amount,
        enrollment_fee: Number(enrollment_fee) || 0,
        insurance_fee: Number(insurance_fee) || 0,
        monthly_fee: Number(monthly_fee) || 0,
        months_count: Number(months_count) || 0,
        installments_count: Number(installments_count) || 1
      })
      .eq('id', id)

    if (feeError) {
      console.error('Errore aggiornamento quota associativa:', feeError)
      return NextResponse.json({ error: 'Errore aggiornamento quota associativa' }, { status: 400 })
    }

    // Gestisci aggiornamento rate predefinite se specificate
    if (installments && Array.isArray(installments)) {
      try {
        // Elimina rate predefinite esistenti
        await adminClient
          .from('predefined_installments')
          .delete()
          .eq('membership_fee_id', id)

        // Crea nuove rate predefinite se specificate
        if (installments.length > 0) {
          const predefinedInstallmentsToCreate = installments.map(installment => ({
            membership_fee_id: id,
            installment_number: installment.installment_number,
            due_date: installment.due_date,
            amount: installment.amount
          }))

          if (predefinedInstallmentsToCreate.length > 0) {
            const { error: predefinedError } = await adminClient
              .from('predefined_installments')
              .insert(predefinedInstallmentsToCreate)

            if (predefinedError) {
              console.error('Errore aggiornamento rate predefinite:', predefinedError)
            }
          }
        }
      } catch (installmentsError) {
        console.error('Errore durante aggiornamento rate predefinite:', installmentsError)
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Quota associativa aggiornata con successo'
    })

  } catch (error) {
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Errore API aggiornamento quota associativa:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    await requireGlobalRole(supabase, 'admin')
    const adminClient = createAdminClient()
    
    const { searchParams } = new URL(request.url)
    const feeId = searchParams.get('id')
    
    if (!feeId) {
      return NextResponse.json({ error: 'ID quota richiesto' }, { status: 400 })
    }

    // 1. Elimina le rate predefinite
    await adminClient
      .from('predefined_installments')
      .delete()
      .eq('membership_fee_id', feeId)

    // 2. Elimina le rate assegnate agli atleti
    await adminClient
      .from('fee_installments')
      .delete()
      .eq('membership_fee_id', feeId)

    // 3. Elimina la quota
    const { error: feeError } = await adminClient
      .from('membership_fees')
      .delete()
      .eq('id', feeId)

    if (feeError) {
      console.error('Errore eliminazione quota associativa:', feeError)
      return NextResponse.json({ error: 'Errore eliminazione quota associativa' }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Quota associativa eliminata con successo'
    })

  } catch (error) {
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Errore API eliminazione quota associativa:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const account = await requireGlobalRole(supabase, 'admin')
    const adminClient = createAdminClient()
    const parsed = membershipActionSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Parametri quota non validi' }, { status: 400 })
    const body = parsed.data

    if (body.action === 'reverse_installment_payment') {
      const { data: installment, error: installmentError } = await adminClient
        .from('fee_installments')
        .select('id, profile_id, membership_fee_id, installment_number, due_date, amount, status, paid_at, paid_by_auth_user_id, payment_source')
        .eq('id', body.installment_id)
        .maybeSingle()

      if (installmentError) {
        console.error('Errore caricamento rata per rettifica pagamento:', installmentError)
        return NextResponse.json({ error: 'Impossibile caricare la rata da rettificare' }, { status: 500 })
      }
      if (!installment) return NextResponse.json({ error: 'Rata non trovata' }, { status: 404 })
      if (installment.status !== 'paid') {
        return NextResponse.json({ error: 'È possibile annullare solo una rata registrata come pagata' }, { status: 409 })
      }

      const newStatus = getUnpaidInstallmentStatus(installment.due_date)
      const { data: updatedInstallment, error: updateError } = await adminClient
        .from('fee_installments')
        .update({
          status: newStatus,
          paid_at: null,
          paid_by_auth_user_id: null,
          payment_source: null,
        })
        .eq('id', installment.id)
        .eq('status', 'paid')
        .select('id')
        .maybeSingle()

      if (updateError) {
        console.error('Errore rettifica pagamento rata:', updateError)
        return NextResponse.json({ error: 'Impossibile rettificare il pagamento della rata' }, { status: 500 })
      }
      if (!updatedInstallment) {
        return NextResponse.json({ error: 'Lo stato della rata è cambiato. Aggiorna l’elenco e riprova.' }, { status: 409 })
      }

      let auditRecorded = true
      try {
        const actor = await getAccountActorSnapshot(adminClient, account.ownerProfileId)
        await recordAccountLifecycleAudit(adminClient, {
          eventType: 'repair_required',
          subjectProfileId: installment.profile_id,
          performedByAuthUserId: account.authUserId,
          performedByProfileId: account.ownerProfileId,
          ...actor,
          details: {
            action: 'fee_installment_payment_reversed',
            installment_id: installment.id,
            membership_fee_id: installment.membership_fee_id,
            profile_id: installment.profile_id,
            installment_number: installment.installment_number,
            amount: installment.amount,
            due_date: installment.due_date,
            previous_status: installment.status,
            previous_paid_at: installment.paid_at,
            previous_paid_by_auth_user_id: installment.paid_by_auth_user_id,
            previous_payment_source: installment.payment_source,
            new_status: newStatus,
            reason: body.reason,
          },
        })
      } catch (auditError) {
        auditRecorded = false
        console.error('Errore audit rettifica pagamento rata:', auditError)
      }

      return NextResponse.json({
        success: true,
        status: newStatus,
        auditRecorded,
        message: auditRecorded
          ? 'Pagamento annullato e rettifica registrata'
          : 'Rata rettificata, ma non è stato possibile registrare la rettifica nel registro audit',
      })
    }

    const { action } = body
    const fee_id = 'fee_id' in body ? body.fee_id : undefined

    // Richiedi fee_id solo per azioni che lo necessitano esplicitamente
    if (action === 'generate_installments') {
      // Ottieni i dettagli della quota
      const { data: fee, error: feeError } = await adminClient
        .from('membership_fees')
        .select('*')
        .eq('id', fee_id)
        .single()

      if (feeError || !fee) {
        return NextResponse.json({ error: 'Quota non trovata' }, { status: 404 })
      }

      // Ottieni le rate predefinite
      const { data: predefinedInstallments, error: predefinedError } = await adminClient
        .from('predefined_installments')
        .select('*')
        .eq('membership_fee_id', fee_id)
        .order('installment_number')

      if (predefinedError) {
        return NextResponse.json({ error: 'Errore recupero rate predefinite' }, { status: 400 })
      }

      if (!predefinedInstallments || predefinedInstallments.length === 0) {
        return NextResponse.json({ error: 'Nessuna rata predefinita trovata per questa quota' }, { status: 400 })
      }

      // Ottieni tutti gli atleti della squadra
      const { data: teamMembers, error: membersError } = await adminClient
        .from('team_members')
        .select('profile_id')
        .eq('team_id', fee.team_id)

      if (membersError) {
        return NextResponse.json({ error: 'Errore recupero membri squadra' }, { status: 400 })
      }

      // Genera le rate per ogni atleta basandosi sulle rate predefinite
      const installmentsToCreate = []

      for (const member of teamMembers || []) {
        for (const predefined of predefinedInstallments) {
          installmentsToCreate.push({
            membership_fee_id: fee_id,
            profile_id: member.profile_id,
            installment_number: predefined.installment_number,
            due_date: predefined.due_date,
            amount: predefined.amount,
            status: 'not_due'
          })
        }
      }

      // Inserisci tutte le rate
      if (installmentsToCreate.length > 0) {
        const { error: installmentsError } = await adminClient
          .from('fee_installments')
          .insert(installmentsToCreate)

        if (installmentsError) {
          console.error('Errore creazione rate:', installmentsError)
          return NextResponse.json({ error: 'Errore creazione rate' }, { status: 400 })
        }
      }

      return NextResponse.json({
        success: true,
        message: `Rate generate con successo per ${teamMembers?.length || 0} atleti basandosi sulle rate predefinite`
      })
    }

    if (action === 'update_installment_status') {
      const { installment_id } = body
      const updateData = {
        status: 'paid' as const,
        paid_at: new Date().toISOString(),
        paid_by_auth_user_id: account.authUserId,
        payment_source: 'admin' as const,
      }

      const { error: updateError } = await adminClient
        .from('fee_installments')
        .update(updateData)
        .eq('id', installment_id)

      if (updateError) {
        console.error('Errore aggiornamento stato rata:', updateError)
        return NextResponse.json({ error: 'Errore aggiornamento stato rata' }, { status: 400 })
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Stato rata aggiornato con successo'
      })
    }

    if (action === 'recalculate_installment_statuses') {
      // Calcola oggi e la data tra 30 giorni (solo parte data)
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]
      const in30 = new Date(today)
      in30.setDate(in30.getDate() + 30)
      const in30Str = in30.toISOString().split('T')[0]

      // Aggiorna SCADUTE: due_date <= oggi, status != paid e != overdue
      const { error: errOverdue } = await adminClient
        .from('fee_installments')
        .update({ status: 'overdue' })
        .lte('due_date', todayStr)
        .neq('status', 'paid' as never)
        .neq('status', 'overdue')

      if (errOverdue) {
        console.error('Errore aggiornamento rate scadute:', errOverdue)
        return NextResponse.json({ error: 'Errore aggiornamento rate scadute' }, { status: 400 })
      }

      // Aggiorna IN SCADENZA: oggi < due_date <= oggi+30, status != paid e != due_soon
      const { error: errDueSoon } = await adminClient
        .from('fee_installments')
        .update({ status: 'due_soon' })
        .gt('due_date', todayStr)
        .lte('due_date', in30Str)
        .neq('status', 'paid' as never)
        .neq('status', 'due_soon')

      if (errDueSoon) {
        console.error('Errore aggiornamento rate in scadenza:', errDueSoon)
        return NextResponse.json({ error: 'Errore aggiornamento rate in scadenza' }, { status: 400 })
      }

      // Aggiorna NON SCADUTE: due_date > oggi+30, status != paid e != not_due
      const { error: errNotDue } = await adminClient
        .from('fee_installments')
        .update({ status: 'not_due' })
        .gt('due_date', in30Str)
        .neq('status', 'paid' as never)
        .neq('status', 'not_due')

      if (errNotDue) {
        console.error('Errore aggiornamento rate non scadute:', errNotDue)
        return NextResponse.json({ error: 'Errore aggiornamento rate non scadute' }, { status: 400 })
      }

      return NextResponse.json({ success: true, message: 'Stati rate ricalcolati' })
    }

    if (action === 'bulk_update_installments') {
      const { installment_ids } = body
      const updateData = {
        status: 'paid' as const,
        paid_at: new Date().toISOString(),
        paid_by_auth_user_id: account.authUserId,
        payment_source: 'admin' as const,
      }

      const { error: updErr } = await adminClient
        .from('fee_installments')
        .update(updateData)
        .in('id', installment_ids)

      if (updErr) {
        console.error('Errore bulk update rate:', updErr)
        return NextResponse.json({ error: 'Errore aggiornamento rate' }, { status: 400 })
      }

      return NextResponse.json({ success: true, message: 'Aggiornamento rate completato' })
    }

    if (action === 'update_installment_details') {
      const { installment_id, due_date, amount } = body

      const updateData: any = {}
      if (due_date) updateData.due_date = due_date
      if (amount !== undefined) updateData.amount = Number(amount)

      const { error: updateError } = await adminClient
        .from('fee_installments')
        .update(updateData)
        .eq('id', installment_id)

      if (updateError) {
        console.error('Errore aggiornamento dettagli rata:', updateError)
        return NextResponse.json({ error: 'Errore aggiornamento dettagli rata' }, { status: 400 })
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Dettagli rata aggiornati con successo'
      })
    }

    return NextResponse.json({ error: 'Azione non supportata' }, { status: 400 })

  } catch (error) {
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Errore API generazione rate:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
