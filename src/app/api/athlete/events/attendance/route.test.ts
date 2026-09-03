import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireSubjectAthleteContext } from '@/server/auth/require-subject-profile'
import { POST } from './route'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/server/auth/require-subject-profile', () => ({ requireSubjectAthleteContext: jest.fn() }))
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, body }),
  },
}))

const createClientMock = createClient as jest.MockedFunction<typeof createClient>
const subjectMock = requireSubjectAthleteContext as jest.MockedFunction<typeof requireSubjectAthleteContext>

describe('POST /api/athlete/events/attendance', () => {
  beforeEach(() => {
    createClientMock.mockResolvedValue({} as Awaited<ReturnType<typeof createClient>>)
    subjectMock.mockReset()
  })

  it('requires confirm_attendance for the requested subject before mutating attendance', async () => {
    subjectMock.mockRejectedValueOnce(new AccountContextError('Permesso non concesso', 403))

    const response = await POST({
      url: 'http://localhost/api/athlete/events/attendance?subjectProfileId=subject-1',
      json: async () => ({ event_id: 'event-1', status: 'going' }),
    } as unknown as NextRequest)

    expect(response.status).toBe(403)
    expect(subjectMock).toHaveBeenCalledWith(expect.anything(), 'subject-1', 'confirm_attendance')
  })
})
