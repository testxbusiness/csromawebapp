import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireSubjectAthleteContext } from '@/server/auth/require-subject-profile'
import { loadAthleteTeamDetail } from '@/server/athlete/team-detail'
import { GET } from './route'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/server/auth/require-subject-profile', () => ({ requireSubjectAthleteContext: jest.fn() }))
jest.mock('@/server/athlete/team-detail', () => ({ loadAthleteTeamDetail: jest.fn() }))
jest.mock('@/server/http/no-store', () => ({ noStoreJson: (body: unknown, status = 200) => ({ body, status }) }))

const createClientMock = createClient as jest.MockedFunction<typeof createClient>
const subjectMock = requireSubjectAthleteContext as jest.MockedFunction<typeof requireSubjectAthleteContext>
const detailMock = loadAthleteTeamDetail as jest.MockedFunction<typeof loadAthleteTeamDetail>

describe('GET /api/athlete/teams/detail', () => {
  beforeEach(() => {
    createClientMock.mockResolvedValue({} as Awaited<ReturnType<typeof createClient>>)
    subjectMock.mockReset()
    detailMock.mockReset()
  })

  it('resolves the requested subject before loading the team detail', async () => {
    const subject = { profileId: 'child-a' }
    const detail = { name: 'U16', code: 'U16', athletes: [] }
    subjectMock.mockResolvedValue(subject as Awaited<ReturnType<typeof requireSubjectAthleteContext>>)
    detailMock.mockResolvedValue(detail)

    const response = await GET({ url: 'http://localhost/api/athlete/teams/detail?id=team-a&subjectProfileId=child-a' } as NextRequest)

    expect(subjectMock).toHaveBeenCalledWith(expect.anything(), 'child-a', 'view_schedule')
    expect(detailMock).toHaveBeenCalledWith(subject, 'team-a')
    expect(response).toEqual({ status: 200, body: detail })
  })

  it('returns 403 without loading team data when subject authorization fails', async () => {
    subjectMock.mockRejectedValue(new AccountContextError('Permesso non concesso', 403))

    const response = await GET({ url: 'http://localhost/api/athlete/teams/detail?id=team-b&subjectProfileId=child-a' } as NextRequest)

    expect(response).toEqual({ status: 403, body: { error: 'Permesso non concesso' } })
    expect(detailMock).not.toHaveBeenCalled()
  })

  it('requires a team id', async () => {
    const response = await GET({ url: 'http://localhost/api/athlete/teams/detail?subjectProfileId=child-a' } as NextRequest)
    expect(response).toEqual({ status: 400, body: { error: 'Missing id' } })
    expect(subjectMock).not.toHaveBeenCalled()
  })
})
