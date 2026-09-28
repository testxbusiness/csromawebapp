import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireSubjectAthleteContext } from '@/server/auth/require-subject-profile'
import { GET } from './route'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/server/auth/require-subject-profile', () => ({ requireSubjectAthleteContext: jest.fn() }))
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, body }),
  },
}))

const createClientMock = createClient as jest.MockedFunction<typeof createClient>
const subjectMock = requireSubjectAthleteContext as jest.MockedFunction<typeof requireSubjectAthleteContext>

describe('GET /api/athlete/fees', () => {
  beforeEach(() => {
    createClientMock.mockResolvedValue({} as Awaited<ReturnType<typeof createClient>>)
    subjectMock.mockReset()
  })

  it('requires view_payments for the requested subject before reading fees', async () => {
    subjectMock.mockRejectedValueOnce(new AccountContextError('Permesso non concesso', 403))

    const response = await GET({
      url: 'http://localhost/api/athlete/fees?subjectProfileId=subject-1',
    } as unknown as NextRequest)

    expect(response.status).toBe(403)
    expect(subjectMock).toHaveBeenCalledWith(expect.anything(), 'subject-1', 'view_payments')
  })
})
