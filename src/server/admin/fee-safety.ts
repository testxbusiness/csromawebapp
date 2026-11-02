export interface FeeInstallmentSafetyRow {
  id: string
  profile_id: string
  membership_fee_id: string
  installment_number: number
  amount: number
  due_date: string
  status: string
  paid_at: string | null
  paid_by_auth_user_id?: string | null
  payment_source?: string | null
  activity_id?: string | null
  season_id?: string | null
}

export function hasPaymentEvidence(row: Pick<FeeInstallmentSafetyRow, 'status' | 'paid_at' | 'paid_by_auth_user_id' | 'payment_source'>) {
  return row.status === 'paid' || row.status === 'partially_paid' || row.paid_at != null
    || row.paid_by_auth_user_id != null || row.payment_source != null
}

/** Read-only diagnostic. Same-plan duplicate rows are a storage duplicate; separate plan IDs are a possible double emission. */
export function diagnoseFeeInstallments(rows: FeeInstallmentSafetyRow[]) {
  const mismatches = rows.filter((row) => (row.paid_at != null) !== (row.status === 'paid'))
    .map(({ id, status, paid_at }) => ({ id, status, paid_at }))
  const byEconomicKey = new Map<string, FeeInstallmentSafetyRow[]>()
  for (const row of rows) {
    if (!row.activity_id || !row.season_id) continue
    const key = `${row.profile_id}:${row.activity_id}:${row.season_id}`
    byEconomicKey.set(key, [...(byEconomicKey.get(key) ?? []), row])
  }
  type DuplicateGroup = { key: string; installmentIds: string[]; planIds: string[]; kind: 'multiple_issued_plans' | 'duplicate_rows' }
  const duplicateGroups: DuplicateGroup[] = [...byEconomicKey.entries()].flatMap<DuplicateGroup>(([key, group]) => {
    const planIds = [...new Set(group.map((row) => row.membership_fee_id))]
    if (group.length < 2) return []
    const exactDuplicate = group.some((row, index) => group.slice(index + 1).some((other) =>
      row.membership_fee_id === other.membership_fee_id
      && row.installment_number === other.installment_number
      && row.amount === other.amount && row.due_date === other.due_date
    ))
    if (planIds.length > 1) return [{ key, installmentIds: group.map((row) => row.id), planIds, kind: 'multiple_issued_plans' }]
    return exactDuplicate ? [{ key, installmentIds: group.map((row) => row.id), planIds, kind: 'duplicate_rows' }] : []
  })
  return { mismatches, duplicateGroups }
}
