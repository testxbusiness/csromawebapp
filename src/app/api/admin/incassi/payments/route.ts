import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const {
      installmentIds,
      paymentDate,
      paymentMethod
    } = body

    if (!installmentIds || !Array.isArray(installmentIds) || installmentIds.length === 0) {
      return NextResponse.json({ error: 'Nessuna rata selezionata' }, { status: 400 })
    }

    if (!paymentDate || !paymentMethod) {
      return NextResponse.json({ error: 'Data e metodo di pagamento sono obbligatori' }, { status: 400 })
    }

    // Get installments to process (only those assigned to athletes)
    const { data: installments, error: fetchError } = await supabase
      .from('fee_installments')
      .select('*')
      .in('id', installmentIds)
      .not('profile_id', 'is', null)

    if (fetchError) {
      console.error('Errore fetch installments:', fetchError)
      return NextResponse.json({ error: 'Errore caricamento rate' }, { status: 500 })
    }

    if (!installments || installments.length === 0) {
      return NextResponse.json({ error: 'Rate non trovate' }, { status: 404 })
    }

    // Process each installment
    const processedInstallments = []
    const errors = []

    for (const installment of installments) {
      try {
        // Update installment - mark as paid
        const { error: updateError } = await supabase
          .from('fee_installments')
          .update({
            paid_at: paymentDate,
            status: 'paid'
          })
          .eq('id', installment.id)

        if (updateError) {
          errors.push(`Errore aggiornamento rata ${installment.id}: ${updateError.message}`)
          continue
        }

        // Note: Non creiamo record nella tabella payments perché è dedicata alle uscite
        // della società, non agli incassi delle quote associative

        processedInstallments.push({
          id: installment.id,
          amount: installment.amount
        })

      } catch (error) {
        console.error(`Errore processamento rata ${installment.id}:`, error)
        errors.push(`Errore processamento rata ${installment.id}`)
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({
        message: `Processate ${processedInstallments.length} rate, errori: ${errors.length}`,
        errors,
        processedInstallments
      }, { status: 207 }) // Multi-status
    }

    return NextResponse.json({
      message: `Pagamento registrato per ${processedInstallments.length} rate`,
      processedInstallments
    })

  } catch (error) {
    console.error('Errore API payments:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}