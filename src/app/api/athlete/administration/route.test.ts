import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireSubjectAthleteContext } from '@/server/auth/require-subject-profile'
import { loadAthleteAdministrationContract } from '@/server/athlete/administration'
import { GET } from './route'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/server/auth/require-subject-profile', () => ({ requireSubjectAthleteContext: jest.fn() }))
jest.mock('@/server/athlete/administration', () => ({ loadAthleteAdministrationContract: jest.fn() }))
jest.mock('@/server/http/no-store', () => ({ noStoreJson: (body: unknown, status = 200) => ({ body, status }) }))

const createClientMock = createClient as jest.MockedFunction<typeof createClient>
const subjectMock = requireSubjectAthleteContext as jest.MockedFunction<typeof requireSubjectAthleteContext>
const administrationMock = loadAthleteAdministrationContract as jest.MockedFunction<typeof loadAthleteAdministrationContract>

describe('GET /api/athlete/administration', () => {
  beforeEach(() => {
    createClientMock.mockResolvedValue({} as Awaited<ReturnType<typeof createClient>>)
    subjectMock.mockReset()
    administrationMock.mockReset()
  })

  it('resolves the requested subject server-side before returning the contract', async () => {
    const subject = { profileId: 'subject-1' }
    subjectMock.mockResolvedValue(subject as Awaited<ReturnType<typeof requireSubjectAthleteContext>>)
    administrationMock.mockResolvedValue({ enrollment_application: { delivered: false }, medical_certificate: null, fees: null })

    const response = await GET({ url: 'http://localhost/api/athlete/administration?subjectProfileId=subject-1' } as NextRequest)

    expect(subjectMock).toHaveBeenCalledWith(expect.anything(), 'subject-1')
    expect(administrationMock).toHaveBeenCalledWith(subject)
    expect(response).toEqual({
      status: 200,
      body: { enrollment_application: { delivered: false }, medical_certificate: null, fees: null },
    })
  })

  it('returns the server authorization error without loading data', async () => {
    subjectMock.mockRejectedValue(new AccountContextError('Permesso non concesso', 403))

    const response = await GET({ url: 'http://localhost/api/athlete/administration?subjectProfileId=subject-1' } as NextRequest)

    expect(response).toEqual({ status: 403, body: { error: 'Permesso non concesso' } })
    expect(administrationMock).not.toHaveBeenCalled()
  })
})
