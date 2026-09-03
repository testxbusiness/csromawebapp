import { membershipFeeSchema } from './membershipFees'

const validFee = {
  team_id: '736a5fc4-9aec-42c3-acd8-c920da5e2be3',
  name: 'Maschile',
  description: 'Quota maschile',
  enrollment_fee: 35,
  insurance_fee: 25,
  monthly_fee: 40,
  months_count: 9.5,
  installments_count: 3,
  installments: [
    { installment_number: 1, due_date: '2026-08-28', amount: 146.67 },
    { installment_number: 2, due_date: '2026-11-28', amount: 146.67 },
    { installment_number: 3, due_date: '2027-02-28', amount: 146.66 },
  ],
}

describe('membershipFeeSchema', () => {
  it('accepts half-month durations', () => {
    expect(membershipFeeSchema.safeParse(validFee).success).toBe(true)
  })

  it('rejects durations that are not whole or half months', () => {
    expect(membershipFeeSchema.safeParse({ ...validFee, months_count: 9.25 }).success).toBe(false)
  })
})
