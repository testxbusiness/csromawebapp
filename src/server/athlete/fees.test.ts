jest.mock('server-only', () => ({}))

import { loadAthleteFeesContract } from './fees'

describe('loadAthleteFeesContract', () => {
  it('loads installments and fee/team/activity context in one relational query', async () => {
    const queryResult = {
      id: 'installment-1',
      installment_number: 1,
      due_date: '2026-09-10',
      amount: 120,
      status: 'due_soon',
      paid_at: null,
      membership_fee_id: 'fee-1',
      membership_fees: [{
        id: 'fee-1',
        team_id: 'team-1',
        name: 'Quota U16',
        total_amount: 120,
        enrollment_fee: 20,
        insurance_fee: 10,
        monthly_fee: 9,
        months_count: 10,
        installments_count: 1,
        teams: [{
          id: 'team-1',
          name: 'U16',
          code: 'U16',
          activity_id: 'activity-1',
          activities: [{ id: 'activity-1', name: 'Volley' }],
        }],
      }],
    }
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      then: (resolve: (value: { data: typeof queryResult[]; error: null }) => unknown) => Promise.resolve(resolve({ data: [queryResult], error: null })),
    }
    const client = { from: jest.fn(() => query) }

    const result = await loadAthleteFeesContract(client as never, 'profile-1', ['team-1'])

    expect(client.from).toHaveBeenCalledTimes(1)
    expect(client.from).toHaveBeenCalledWith('fee_installments')
    expect(query.in).toHaveBeenCalledWith('membership_fees.team_id', ['team-1'])
    expect(result.installments[0]).toMatchObject({
      id: 'installment-1',
      membership_fee: { id: 'fee-1', team: { id: 'team-1', activity: { id: 'activity-1', name: 'Volley' } } },
    })
  })

  it('avoids a database request when the subject has no active teams', async () => {
    const client = { from: jest.fn() }

    await expect(loadAthleteFeesContract(client as never, 'profile-1', [])).resolves.toEqual({ installments: [] })
    expect(client.from).not.toHaveBeenCalled()
  })
})
