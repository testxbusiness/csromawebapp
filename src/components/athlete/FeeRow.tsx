'use client'

import { useState } from 'react'
import type { AthleteFeeInstallment, AthleteFeeStatus } from '@/types/athlete-fees'
import { StatusBadge } from '@/components/ui'

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
      <button type="button" className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[color:var(--cs-surface-selected)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--cs-brand-red)]" aria-expanded={expanded} aria-controls={`fee-detail-${installment.id}`} onClick={() => setExpanded((value) => !value)}>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-[color:var(--cs-text)]">{fee.name} · Rata {installment.installment_number}</span>
          <span className="mt-0.5 block truncate text-xs text-[color:var(--cs-text-secondary)]">Scadenza {formatDate(installment.due_date)}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-variant-numeric tabular-nums text-sm font-semibold text-[color:var(--cs-text)]">{formatAmount(financials.due_amount)}</span>
          <span className="block text-xs text-[color:var(--cs-text-secondary)]">residuo {formatAmount(financials.remaining_amount)}</span>
        </span>
        <StatusBadge status={STATUS_VARIANT[installment.status]} label={STATUS_COPY[installment.status]} />
        <span aria-hidden="true" className="w-4 text-center text-lg text-[color:var(--cs-text-secondary)]">{expanded ? '−' : '+'}</span>
      </button>
      {expanded ? (
        <div id={`fee-detail-${installment.id}`} className="grid gap-3 border-t border-[color:var(--cs-border-canonical)] bg-[color:var(--cs-surface-subdued)] px-4 py-4 text-sm sm:grid-cols-2">
          <div><p className="text-xs uppercase tracking-wide text-[color:var(--cs-text-secondary)]">Importo dovuto</p><p className="font-variant-numeric tabular-nums font-semibold">{formatAmount(financials.due_amount)}</p></div>
          <div><p className="text-xs uppercase tracking-wide text-[color:var(--cs-text-secondary)]">Importo pagato</p><p className="font-variant-numeric tabular-nums font-semibold">{formatAmount(financials.paid_amount)}</p></div>
          <div><p className="text-xs uppercase tracking-wide text-[color:var(--cs-text-secondary)]">Importo residuo</p><p className="font-variant-numeric tabular-nums font-semibold">{formatAmount(financials.remaining_amount)}</p></div>
          <div><p className="text-xs uppercase tracking-wide text-[color:var(--cs-text-secondary)]">Attività</p><p className="font-medium">{fee.team.activity.name}</p></div>
          {fee.description ? <p className="text-[color:var(--cs-text-secondary)] sm:col-span-2">{fee.description}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
