import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireSubjectAthleteContext } from '@/server/auth/require-subject-profile'
import { loadAthleteDashboardAdministrativeAlerts } from '@/server/athlete/administration'
import { GET } from './route'

jest.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/server/auth/require-subject-profile', () => ({ requireSubjectAthleteContext: jest.fn() }))
jest.mock('@/server/athlete/administration', () => ({ loadAthleteDashboardAdministrativeAlerts: jest.fn() }))

const createClientMock = createClient as jest.MockedFunction<typeof createClient>
const subjectMock = requireSubjectAthleteContext as jest.MockedFunction<typeof requireSubjectAthleteContext>
const alertsMock = loadAthleteDashboardAdministrativeAlerts as jest.MockedFunction<typeof loadAthleteDashboardAdministrativeAlerts>

describe('GET /api/athlete/dashboard/alerts', () => {
  beforeEach(() => {
    createClientMock.mockResolvedValue({} as Awaited<ReturnType<typeof createClient>>)
    subjectMock.mockReset()
    alertsMock.mockReset()
  })

  it('resolves alerts for the authorized subject independently from the dashboard payload', async () => {
    const subject = { profileId: 'child-1' } as Awaited<ReturnType<typeof requireSubjectAthleteContext>>
    subjectMock.mockResolvedValue(subject)
    alertsMock.mockResolvedValue([
      { area: 'fees', tone: 'danger', message: 'Quota associativa scaduta', href: '/athlete/fees?section=fees' },
    ])

    const response = await GET({
      url: 'http://localhost/api/athlete/dashboard/alerts?subjectProfileId=child-1',
    } as NextRequest)

    expect(subjectMock).toHaveBeenCalledWith(expect.anything(), 'child-1')
    expect(alertsMock).toHaveBeenCalledWith(subject)
    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      administrativeAlerts: [
        { area: 'fees', tone: 'danger', message: 'Quota associativa scaduta', href: '/athlete/fees?section=fees' },
      ],
    })
  })

  it('preserves authorization errors from subject resolution', async () => {
    subjectMock.mockRejectedValue(new AccountContextError('Permesso non concesso', 403))

    const response = await GET({
      url: 'http://localhost/api/athlete/dashboard/alerts?subjectProfileId=child-1',
    } as NextRequest)

    expect(alertsMock).not.toHaveBeenCalled()
    expect(response.status).toBe(403)
    expect(response.body).toEqual({ error: 'Permesso non concesso' })
  })
})
