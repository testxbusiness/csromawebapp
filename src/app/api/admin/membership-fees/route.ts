import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    const body = await request.json()
    
    const {
      team_id,
      name,
      description,
      enrollment_fee,
      insurance_fee,
      monthly_fee,
      months_count,
      installments_count,
      installments
    } = body

    // Verifica che l'utente corrente sia admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (user as any)?.user_metadata?.role
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Calcola importo totale
    const total_amount = (parseFloat(enrollment_fee) || 0) + 
                        (parseFloat(insurance_fee) || 0) + 
                        ((parseFloat(monthly_fee) || 0) * (parseFloat((months_count || '0').toString().replace(',', '.')) || 0))

    // Crea la quota associativa
    const { data: fee, error: feeError } = await adminClient
      .from('membership_fees')
      .insert({
        team_id,
        name,
        description: description || null,
        total_amount,
        enrollment_fee: parseFloat(enrollment_fee) || 0,
        insurance_fee: parseFloat(insurance_fee) || 0,
        monthly_fee: parseFloat(monthly_fee) || 0,
        months_count: parseFloat((months_count || '0').toString().replace(',', '.')) || 0,
        installments_count: parseInt(installments_count) || 1,
        created_by: user.id
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
    console.error('Errore API creazione quota associativa:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    
    // Verifica che l'utente corrente sia admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (user as any)?.user_metadata?.role
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Prima ottieni solo le quote base
    const { data: feesData, error } = await adminClient
      .from('membership_fees')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Ora arricchisci con i dati correlati
    const enrichedFees = await Promise.all(
      (feesData || []).map(async (fee) => {
        const enrichedFee = { ...fee }

        // Ottieni dati squadra
        if (fee.team_id) {
          const { data: teamData } = await adminClient
            .from('teams')
            .select('id, name, code')
            .eq('id', fee.team_id)
            .single()
          
          if (teamData) {
            enrichedFee.teams = teamData
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
    console.error('Errore API lista quote associative:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    const body = await request.json()
    
    const {
      id,
      team_id,
      name,
      description,
      enrollment_fee,
      insurance_fee,
      monthly_fee,
      months_count,
      installments_count,
      installments
    } = body

    // Verifica che l'utente corrente sia admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (user as any)?.user_metadata?.role
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!id) {
      return NextResponse.json({ error: 'ID quota richiesto' }, { status: 400 })
    }

    // Calcola importo totale
    const total_amount = (parseFloat(enrollment_fee) || 0) + 
                        (parseFloat(insurance_fee) || 0) + 
                        ((parseFloat(monthly_fee) || 0) * (parseFloat((months_count || '0').toString().replace(',', '.')) || 0))

    // Aggiorna la quota associativa
    const { error: feeError } = await adminClient
      .from('membership_fees')
      .update({
        team_id,
        name,
        description: description || null,
        total_amount,
        enrollment_fee: parseFloat(enrollment_fee) || 0,
        insurance_fee: parseFloat(insurance_fee) || 0,
        monthly_fee: parseFloat(monthly_fee) || 0,
        months_count: parseFloat((months_count || '0').toString().replace(',', '.')) || 0,
        installments_count: parseInt(installments_count) || 1
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
    console.error('Errore API aggiornamento quota associativa:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    
    // Verifica che l'utente corrente sia admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (user as any)?.user_metadata?.role
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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
    console.error('Errore API eliminazione quota associativa:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    const body = await request.json()
    
    console.log('PATCH request body:', body)
    
    const { fee_id, action } = body

    // Verifica che l'utente corrente sia admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (user as any)?.user_metadata?.role
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Richiedi fee_id solo per azioni che lo necessitano esplicitamente
    const requiresFeeId = action === 'generate_installments'
    if (requiresFeeId && !fee_id) {
      return NextResponse.json({ error: 'ID quota richiesto' }, { status: 400 })
    }

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
      const { installment_id, status } = body
      
      if (!installment_id || !status) {
        return NextResponse.json({ error: 'ID rata e stato richiesti' }, { status: 400 })
      }

      const updateData: any = { status }
      if (status === 'paid') {
        updateData.paid_at = new Date().toISOString()
      } else if (status !== 'paid' && body.paid_at) {
        updateData.paid_at = null
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
        .neq('status', 'paid')
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
        .neq('status', 'paid')
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
        .neq('status', 'paid')
        .neq('status', 'not_due')

      if (errNotDue) {
        console.error('Errore aggiornamento rate non scadute:', errNotDue)
        return NextResponse.json({ error: 'Errore aggiornamento rate non scadute' }, { status: 400 })
      }

      return NextResponse.json({ success: true, message: 'Stati rate ricalcolati' })
    }

    if (action === 'bulk_update_installments') {
      const { installment_ids, status } = body as any
      if (!Array.isArray(installment_ids) || installment_ids.length === 0 || !status) {
        return NextResponse.json({ error: 'Parametri non validi' }, { status: 400 })
      }
      const updateData: any = { status }
      if (status === 'paid') updateData.paid_at = new Date().toISOString()
      else if (status !== 'paid') updateData.paid_at = null

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
      
      if (!installment_id) {
        return NextResponse.json({ error: 'ID rata richiesto' }, { status: 400 })
      }

      const updateData: any = {}
      if (due_date) updateData.due_date = due_date
      if (amount !== undefined) updateData.amount = parseFloat(amount)

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: 'Nessun dato da aggiornare' }, { status: 400 })
      }

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
    console.error('Errore API generazione rate:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
