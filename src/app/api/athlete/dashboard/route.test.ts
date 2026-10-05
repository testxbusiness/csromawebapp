import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireSubjectAthleteContext } from '@/server/auth/require-subject-profile'
import { GET } from './route'

jest.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(), createAdminClient: jest.fn() }))
jest.mock('@/server/auth/require-subject-profile', () => ({ requireSubjectAthleteContext: jest.fn() }))

const createClientMock = createClient as jest.MockedFunction<typeof createClient>
const subjectMock = requireSubjectAthleteContext as jest.MockedFunction<typeof requireSubjectAthleteContext>

describe('GET /api/athlete/dashboard', () => {
  beforeEach(() => {
    createClientMock.mockResolvedValue({} as Awaited<ReturnType<typeof createClient>>)
    subjectMock.mockReset()
  })

  it('revalidates the requested delegated subject before loading dashboard data', async () => {
    subjectMock.mockRejectedValue(new AccountContextError('Permesso non concesso', 403))

    const response = await GET({ url: 'http://localhost/api/athlete/dashboard?subjectProfileId=child-1' } as NextRequest)

    expect(subjectMock).toHaveBeenCalledWith(expect.anything(), 'child-1')
    expect(response).toEqual({ status: 403, body: { error: 'Permesso non concesso' } })
  })
})
