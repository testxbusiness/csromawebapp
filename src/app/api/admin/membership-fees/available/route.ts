import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('team_id')

    // Verifica che l'utente corrente sia admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (user as any)?.user_metadata?.role
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Query per recuperare i piani di pagamento disponibili
    let query = adminClient
      .from('membership_fees')
      .select(`
        id,
        name,
        description,
        total_amount,
        enrollment_fee,
        insurance_fee,
        monthly_fee,
        months_count,
        installments_count,
        team_id,
        teams!inner(id, name, code)
      `)
      .order('name', { ascending: true })

    // Se specificato team_id, filtra per quella squadra
    if (teamId) {
      query = query.eq('team_id', teamId)
    }

    const { data: fees, error } = await query

    if (error) {
      console.error('Errore recupero piani di pagamento:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Formatta i dati per il frontend
    const formattedFees = fees?.map(fee => ({
      id: fee.id,
      name: fee.name,
      description: fee.description,
      total_amount: fee.total_amount,
      enrollment_fee: fee.enrollment_fee,
      insurance_fee: fee.insurance_fee,
      monthly_fee: fee.monthly_fee,
      months_count: fee.months_count,
      installments_count: fee.installments_count,
      team_id: fee.team_id,
      team_name: fee.teams?.name,
      team_code: fee.teams?.code
    })) || []

    return NextResponse.json({
      membership_fees: formattedFees,
      total: formattedFees.length
    })

  } catch (error) {
    console.error('Errore API piani di pagamento disponibili:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}