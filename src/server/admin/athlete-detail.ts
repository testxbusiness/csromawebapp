export type AthleteDetailInstallment = {
  id: string
  installment_number: number
  due_date: string
  amount: number
  status: string
  paid_at: string | null
}

export type AthleteDetailPlan = {
  id: string
  name: string | null
  teamId: string
  teamName: string
  activityId: string
  activityName: string
  installments: AthleteDetailInstallment[]
}

export function summarizeAthletePlans(plans: AthleteDetailPlan[]) {
  const totalDue = plans.flatMap((plan) => plan.installments).reduce((sum, installment) => sum + installment.amount, 0)
  const totalPaid = plans.flatMap((plan) => plan.installments)
    .reduce((sum, installment) => sum + (installment.paid_at ? installment.amount : 0), 0)

  return {
    totalDue,
    totalPaid,
    remaining: totalDue - totalPaid,
    hasMultiplePlansPerActivity: plans.some((plan) =>
      plans.filter((candidate) => candidate.activityId === plan.activityId).length > 1
    ),
  }
}
