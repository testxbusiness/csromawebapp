import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Get current date for status calculations
    const today = new Date()
    const dueSoonDate = new Date(today)
    dueSoonDate.setDate(today.getDate() + 30) // 30 days from now

    // Get only installments assigned to athletes
    const { data: installments, error } = await supabase
      .from('fee_installments')
      .select('amount, due_date, status, paid_at')
      .not('profile_id', 'is', null)

    if (error) {
      console.error('Errore query installments:', error)
      return NextResponse.json({ error: 'Errore caricamento dati' }, { status: 500 })
    }

    // Calculate KPI data
    let not_due = 0
    let due_soon = 0
    let overdue = 0
    let partially_paid = 0
    let paid = 0
    let total_amount = 0
    let total_paid = 0

    installments.forEach(installment => {
      const installmentDate = new Date(installment.due_date)

      // Calculate status based on paid_at date and due date
      let status = installment.status
      if (!status) {
        if (installment.paid_at) {
          status = 'paid'
        } else if (installmentDate < today) {
          status = 'overdue'
        } else if (installmentDate <= dueSoonDate) {
          status = 'due_soon'
        } else {
          status = 'not_due'
        }
      }

      // Count by status
      switch (status) {
        case 'not_due':
          not_due++
          break
        case 'due_soon':
          due_soon++
          break
        case 'overdue':
          overdue++
          break
        case 'partially_paid':
          partially_paid++
          break
        case 'paid':
          paid++
          break
      }

      // Calculate amounts
      total_amount += installment.amount
      if (installment.paid_at) {
        total_paid += installment.amount // Full amount paid if paid_at is set
      }
    })

    const kpiData = {
      not_due,
      due_soon,
      overdue,
      partially_paid,
      paid,
      total_amount,
      total_paid
    }

    return NextResponse.json({ data: kpiData })
  } catch (error) {
    console.error('Errore API KPI:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}