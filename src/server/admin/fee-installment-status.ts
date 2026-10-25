export type UnpaidInstallmentStatus = 'not_due' | 'due_soon' | 'overdue'

export function getUnpaidInstallmentStatus(
  dueDate: string,
  now = new Date(),
): UnpaidInstallmentStatus {
  const today = now.toISOString().slice(0, 10)
  const inThirtyDays = new Date(`${today}T00:00:00.000Z`)
  inThirtyDays.setUTCDate(inThirtyDays.getUTCDate() + 30)
  const inThirtyDaysDate = inThirtyDays.toISOString().slice(0, 10)

  if (dueDate <= today) return 'overdue'
  if (dueDate <= inThirtyDaysDate) return 'due_soon'
  return 'not_due'
}
