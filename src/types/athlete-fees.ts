export const ATHLETE_FEE_STATUSES = [
  'not_due',
  'due_soon',
  'overdue',
  'partially_paid',
  'paid',
] as const

export type AthleteFeeStatus = (typeof ATHLETE_FEE_STATUSES)[number]

export interface AthleteFeeTeam {
  id: string
  name: string
  code: string
  activity: {
    id: string | null
    name: string
  }
}

export interface AthleteFeeFinancials {
  /** Importo della rata, sempre positivo o zero. */
  due_amount: number
  /** Importo contabilizzato come pagato; null se il DB non espone un valore parziale. */
  paid_amount: number | null
  /** Dovuto meno pagato; null quando il pagato parziale non è noto. */
  remaining_amount: number | null
}

export interface AthleteFeeInstallment {
  id: string
  installment_number: number
  due_date: string
  /** Legacy alias of financials.due_amount. */
  amount: number
  status: AthleteFeeStatus
  paid_at?: string
  financials: AthleteFeeFinancials
  membership_fee: {
    id: string
    name: string
    description?: string
    total_amount: number
    enrollment_fee: number
    insurance_fee: number
    monthly_fee: number
    months_count: number
    installments_count: number
    team_id: string
    activity_id: string | null
    team: AthleteFeeTeam
  }
}

export interface AthleteFeesContract {
  installments: AthleteFeeInstallment[]
}
