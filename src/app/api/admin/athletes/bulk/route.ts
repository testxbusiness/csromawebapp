import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

interface TeamAssignmentParameters {
  teamIds: string[]
  jerseyNumber?: string
  membershipFeeId?: string
}

interface TeamRemovalParameters {
  teamId: string
}

interface JerseyUpdateParameters {
  jerseyNumber: string
  teamId: string
}

interface MedicalExpiryParameters {
  expiryDate: string
}

interface UserWithMetadata {
  user_metadata?: {
    role?: string
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const requesterRole = (user as UserWithMetadata)?.user_metadata?.role
    if (requesterRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { operation, athleteIds, parameters, dryRun = false } = body

    if (!operation || !athleteIds || !Array.isArray(athleteIds)) {
      return NextResponse.json({ error: 'Parametri mancanti o non validi' }, { status: 400 })
    }

    // Gestione operazioni massive
    switch (operation) {
      case 'assign_to_team':
        return await handleTeamAssignment(adminClient, athleteIds, parameters, dryRun)

      case 'remove_from_team':
        return await handleTeamRemoval(adminClient, athleteIds, parameters, dryRun)

      case 'update_jersey':
        return await handleJerseyUpdate(adminClient, athleteIds, parameters, dryRun)

      case 'update_medical_expiry':
        return await handleMedicalExpiryUpdate(adminClient, athleteIds, parameters, dryRun)

      default:
        return NextResponse.json({ error: 'Operazione non supportata' }, { status: 400 })
    }
  } catch (error) {
    console.error('Errore API operazioni massive atleti:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

// Funzioni helper per operazioni massive
async function handleTeamAssignment(adminClient: ReturnType<typeof createAdminClient>, athleteIds: string[], parameters: TeamAssignmentParameters, dryRun: boolean) {
  const { teamId, jerseyNumber, membershipFeeId } = parameters

  if (!teamId) {
    return NextResponse.json({ error: 'ID squadra mancante' }, { status: 400 })
  }

  // Verifica che la squadra esista
  const { data: team, error: teamError } = await adminClient
    .from('teams')
    .select('id, name')
    .eq('id', teamId)
    .single()

  if (teamError || !team) {
    return NextResponse.json({ error: 'Squadra non trovata' }, { status: 404 })
  }

  // Verifica che il piano di pagamento esista (se specificato)
  let membershipFee = null
  if (membershipFeeId) {
    const { data: feeData, error: feeError } = await adminClient
      .from('membership_fees')
      .select('id, name, team_id')
      .eq('id', membershipFeeId)
      .single()

    if (feeError || !feeData) {
      return NextResponse.json({ error: 'Piano di pagamento non trovato' }, { status: 404 })
    }

    // Verifica che il piano di pagamento sia associato alla squadra corretta
    if (feeData.team_id !== teamId) {
      return NextResponse.json({ error: 'Il piano di pagamento non è associato alla squadra selezionata' }, { status: 400 })
    }

    membershipFee = feeData
  }

  if (dryRun) {
    const feeMessage = membershipFee ? ` con piano di pagamento "${membershipFee.name}"` : ''
    return NextResponse.json({
      message: `DRY RUN: ${athleteIds.length} atleti verrebbero assegnati alla squadra "${team.name}"${feeMessage}`,
      operation: 'assign_to_team',
      affected: athleteIds.length,
      parameters: { teamId, teamName: team.name, jerseyNumber, membershipFeeId }
    })
  }

  // Assegna gli atleti alla squadra
  const assignments = athleteIds.map(athleteId => ({
    profile_id: athleteId,
    team_id: teamId,
    jersey_number: jerseyNumber ? parseInt(jerseyNumber) : null
  }))

  const { error } = await adminClient
    .from('team_members')
    .upsert(assignments, { onConflict: 'profile_id,team_id' })

  if (error) {
    console.error('Errore assegnazione atleti:', error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Assegna il piano di pagamento se specificato
  if (membershipFeeId) {
    // Prima rimuovi eventuali installments esistenti per questi atleti
    await adminClient
      .from('fee_installments')
      .delete()
      .in('profile_id', athleteIds)
      .eq('membership_fee_id', membershipFeeId)

    // Recupera le rate predefinite del piano di pagamento
    const { data: predefinedInstallments, error: predefinedError } = await adminClient
      .from('predefined_installments')
      .select('*')
      .eq('membership_fee_id', membershipFeeId)
      .order('installment_number')

    if (!predefinedError && predefinedInstallments && predefinedInstallments.length > 0) {
      // Crea gli installments per ogni atleta basandosi sulle rate predefinite
      const installments = []
      const today = new Date()
      const dueSoonDate = new Date(today)
      dueSoonDate.setDate(today.getDate() + 30) // 30 giorni da oggi

      for (const athleteId of athleteIds) {
        for (const predefined of predefinedInstallments) {
          // Calcola lo status in base alla data di scadenza
          let status = 'not_due'
          const dueDate = new Date(predefined.due_date)

          if (dueDate < today) {
            status = 'overdue'
          } else if (dueDate <= dueSoonDate) {
            status = 'due_soon'
          }

          installments.push({
            profile_id: athleteId,
            membership_fee_id: membershipFeeId,
            installment_number: predefined.installment_number,
            due_date: predefined.due_date,
            amount: predefined.amount,
            status: status,
            created_at: new Date().toISOString()
          })
        }
      }

      // Inserisci gli installments
      if (installments.length > 0) {
        const { error: installmentsError, data: inserted } = await adminClient
          .from('fee_installments')
          .insert(installments)

        if (installmentsError) {
          console.error('Errore creazione installments:', installmentsError)
          // In preview, includi dettagli per debug
          if (process.env.VERCEL_ENV !== 'production') {
            return NextResponse.json({
              error: 'Errore creazione rate',
              debug: {
                code: (installmentsError as any)?.code,
                message: (installmentsError as any)?.message,
                details: (installmentsError as any)?.details,
                hint: (installmentsError as any)?.hint,
                attempting: installments.length,
              }
            }, { status: 400 })
          }
        } else {
          console.log('Installments created:', inserted?.length ?? 0)
        }
      }
    } else {
      console.error('Nessuna rata predefinita trovata per il piano di pagamento:', membershipFeeId)
    }
  }

  const feeMessage = membershipFee ? ` con piano di pagamento "${membershipFee.name}"` : ''
  return NextResponse.json({
    message: `${athleteIds.length} atleti assegnati alla squadra "${team.name}"${feeMessage}`,
    operation: 'assign_to_team',
    affected: athleteIds.length,
    teamName: team.name
  })
}

async function handleTeamRemoval(adminClient: ReturnType<typeof createAdminClient>, athleteIds: string[], parameters: TeamRemovalParameters, dryRun: boolean) {
  const { teamId } = parameters

  if (!teamId) {
    return NextResponse.json({ error: 'ID squadra mancante' }, { status: 400 })
  }

  // Verifica che la squadra esista
  const { data: team, error: teamError } = await adminClient
    .from('teams')
    .select('id, name')
    .eq('id', teamId)
    .single()

  if (teamError || !team) {
    return NextResponse.json({ error: 'Squadra non trovata' }, { status: 404 })
  }

  if (dryRun) {
    return NextResponse.json({
      message: `DRY RUN: ${athleteIds.length} atleti verrebbero rimossi dalla squadra "${team.name}"`,
      operation: 'remove_from_team',
      affected: athleteIds.length,
      parameters: { teamId, teamName: team.name }
    })
  }

  // Rimuovi gli atleti dalla squadra
  const { error } = await adminClient
    .from('team_members')
    .delete()
    .in('profile_id', athleteIds)
    .eq('team_id', teamId)

  if (error) {
    console.error('Errore rimozione atleti:', error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({
    message: `${athleteIds.length} atleti rimossi dalla squadra "${team.name}"`,
    operation: 'remove_from_team',
    affected: athleteIds.length,
    teamName: team.name
  })
}

async function handleJerseyUpdate(adminClient: ReturnType<typeof createAdminClient>, athleteIds: string[], parameters: JerseyUpdateParameters, dryRun: boolean) {
  const { jerseyNumber, teamId } = parameters

  if (!jerseyNumber || !teamId) {
    return NextResponse.json({ error: 'Numero maglia o ID squadra mancanti' }, { status: 400 })
  }

  // Verifica che la squadra esista
  const { data: team, error: teamError } = await adminClient
    .from('teams')
    .select('id, name')
    .eq('id', teamId)
    .single()

  if (teamError || !team) {
    return NextResponse.json({ error: 'Squadra non trovata' }, { status: 404 })
  }

  if (dryRun) {
    return NextResponse.json({
      message: `DRY RUN: ${athleteIds.length} atleti avrebbero il numero maglia aggiornato a "${jerseyNumber}" nella squadra "${team.name}"`,
      operation: 'update_jersey',
      affected: athleteIds.length,
      parameters: { teamId, teamName: team.name, jerseyNumber }
    })
  }

  // Aggiorna il numero maglia degli atleti
  const { error } = await adminClient
    .from('team_members')
    .update({ jersey_number: parseInt(jerseyNumber) })
    .in('profile_id', athleteIds)
    .eq('team_id', teamId)

  if (error) {
    console.error('Errore aggiornamento numero maglia:', error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({
    message: `${athleteIds.length} atleti hanno aggiornato il numero maglia a "${jerseyNumber}" nella squadra "${team.name}"`,
    operation: 'update_jersey',
    affected: athleteIds.length,
    teamName: team.name,
    jerseyNumber
  })
}

async function handleMedicalExpiryUpdate(adminClient: ReturnType<typeof createAdminClient>, athleteIds: string[], parameters: MedicalExpiryParameters, dryRun: boolean) {
  const { expiryDate } = parameters

  if (!expiryDate) {
    return NextResponse.json({ error: 'Data scadenza mancante' }, { status: 400 })
  }

  // Valida la data
  const expiryDateObj = new Date(expiryDate)
  if (isNaN(expiryDateObj.getTime())) {
    return NextResponse.json({ error: 'Data scadenza non valida' }, { status: 400 })
  }

  if (dryRun) {
    return NextResponse.json({
      message: `DRY RUN: ${athleteIds.length} atleti avrebbero la data scadenza certificato medico aggiornata a "${expiryDate}"`,
      operation: 'update_medical_expiry',
      affected: athleteIds.length,
      parameters: { expiryDate }
    })
  }

  // Aggiorna la data scadenza certificato medico
  const updates = athleteIds.map(athleteId => ({
    profile_id: athleteId,
    medical_certificate_expiry: expiryDate
  }))

  const { error } = await adminClient
    .from('athlete_profiles')
    .upsert(updates, { onConflict: 'profile_id' })

  if (error) {
    console.error('Errore aggiornamento scadenza certificato:', error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({
    message: `${athleteIds.length} atleti hanno aggiornato la scadenza certificato medico a "${expiryDate}"`,
    operation: 'update_medical_expiry',
    affected: athleteIds.length,
    expiryDate
  })
}
