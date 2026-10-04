'use client'

import { useState } from 'react'
import type { AthleteFeeInstallment, AthleteFeeStatus } from '@/types/athlete-fees'
import { ListRow, StatusBadge } from '@/components/ui'

const STATUS_COPY: Record<AthleteFeeStatus, string> = {
  not_due: 'Non ancora dovuta', due_soon: 'In scadenza', overdue: 'Scaduta', partially_paid: 'Parziale', paid: 'Pagata',
}
const STATUS_VARIANT: Record<AthleteFeeStatus, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  not_due: 'info', due_soon: 'warning', overdue: 'danger', partially_paid: 'warning', paid: 'success',
}

function formatAmount(value: number | null): string {
  return value == null ? '—' : new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value)
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
}

export function FeeRow({ installment }: { installment: AthleteFeeInstallment }) {
  const [expanded, setExpanded] = useState(false)
  const fee = installment.membership_fee
  const financials = installment.financials

  return (
    <div className="border-t border-[color:var(--cs-border-canonical)] first:border-t-0">
      <ListRow interactive className="px-4 py-3" aria-expanded={expanded} aria-controls={`fee-detail-${installment.id}`} onClick={() => setExpanded((value) => !value)} trailing={<span className="flex shrink-0 items-center gap-3">
        <span className="text-right">
          <span className="block font-variant-numeric tabular-nums text-sm font-semibold text-[color:var(--cs-text)]">{formatAmount(financials.due_amount)}</span>
          <span className="block text-xs text-[color:var(--cs-text-secondary)]">residuo {formatAmount(financials.remaining_amount)}</span>
        </span>
        <StatusBadge status={STATUS_VARIANT[installment.status]} label={STATUS_COPY[installment.status]} />
        <span aria-hidden="true" className="w-4 text-center text-lg text-[color:var(--cs-text-secondary)]">{expanded ? '−' : '+'}</span>
      </span>}>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-[color:var(--cs-text)]">{fee.name} · Rata {installment.installment_number}</span>
          <span className="mt-0.5 block text-xs text-[color:var(--cs-text-secondary)]">Scadenza {formatDate(installment.due_date)}</span>
        </span>
      </ListRow>
      {expanded ? (
        <div id={`fee-detail-${installment.id}`} className="cs-fee-detail grid gap-0 border-t border-[color:var(--cs-border-canonical)] px-4 py-2 text-sm sm:grid-cols-2">
          <div className="border-b border-[color:var(--cs-border-canonical)] py-3 sm:border-r sm:pr-4"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--cs-text-secondary)]">Importo dovuto</p><p className="font-variant-numeric tabular-nums font-semibold">{formatAmount(financials.due_amount)}</p></div>
          <div className="border-b border-[color:var(--cs-border-canonical)] py-3 sm:pl-4"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--cs-text-secondary)]">Importo pagato</p><p className="font-variant-numeric tabular-nums font-semibold">{formatAmount(financials.paid_amount)}</p></div>
          <div className="border-b border-[color:var(--cs-border-canonical)] py-3 sm:border-r sm:pr-4"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--cs-text-secondary)]">Importo residuo</p><p className="font-variant-numeric tabular-nums font-semibold">{formatAmount(financials.remaining_amount)}</p></div>
          <div className="border-b border-[color:var(--cs-border-canonical)] py-3 sm:pl-4"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--cs-text-secondary)]">Attività</p><p className="font-medium">{fee.team.activity.name}</p></div>
          {fee.description ? <p className="py-3 text-[color:var(--cs-text-secondary)] sm:col-span-2">{fee.description}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
