export type FeePreviewStatus = 'not_due' | 'due_soon' | 'overdue' | 'paid' | 'partially_paid'

type FeePreviewItem = {
  due_date: string
  status: FeePreviewStatus
}

const URGENCY: Record<FeePreviewStatus, number> = {
  overdue: 0,
  due_soon: 1,
  partially_paid: 2,
  not_due: 3,
  paid: 4,
}

export function selectMostUrgentFee<T extends FeePreviewItem>(fees: T[]): T | undefined {
  return fees
    .filter((fee) => fee.status !== 'paid')
    .sort((left, right) => URGENCY[left.status] - URGENCY[right.status] || left.due_date.localeCompare(right.due_date))[0]
}

export function feeStatusLabel(status: FeePreviewStatus): string {
  switch (status) {
    case 'overdue': return 'Scaduta'
    case 'due_soon': return 'In scadenza'
    case 'partially_paid': return 'Parzialmente pagata'
    case 'paid': return 'Pagata'
    case 'not_due': return 'Non scaduta'
  }
}
