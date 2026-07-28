import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { incassiPaymentSchema } from '@/lib/validation/bulk'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if ((user as any).app_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const parsed = incassiPaymentSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Dati pagamento non validi' }, { status: 400 })
    const { installmentIds, paymentDate, paymentMethod } = parsed.data

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
