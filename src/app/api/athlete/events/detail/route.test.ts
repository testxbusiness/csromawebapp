import type { NextRequest } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { requireSubjectAthleteContext } from '@/server/auth/require-subject-profile'
import { resolveAttendanceAvailability } from '@/server/events/attendance-availability'
import { GET } from './route'

jest.mock('@/lib/supabase/server', () => ({ createAdminClient: jest.fn(), createClient: jest.fn() }))
jest.mock('@/server/auth/require-subject-profile', () => ({ requireSubjectAthleteContext: jest.fn() }))
jest.mock('@/server/events/attendance-availability', () => ({ resolveAttendanceAvailability: jest.fn() }))
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, body }),
  },
}))

const createClientMock = createClient as jest.MockedFunction<typeof createClient>
const createAdminClientMock = createAdminClient as jest.MockedFunction<typeof createAdminClient>
const subjectMock = requireSubjectAthleteContext as jest.MockedFunction<typeof requireSubjectAthleteContext>
const availabilityMock = resolveAttendanceAvailability as jest.MockedFunction<typeof resolveAttendanceAvailability>

function query<T>(result: { data: T; error?: null }) {
  type QueryBuilder = {
    select: () => QueryBuilder
    eq: () => QueryBuilder
    in: () => QueryBuilder
    maybeSingle: () => Promise<typeof result>
    then: (resolve: (value: typeof result) => unknown) => Promise<unknown>
  }
  const builder = {} as QueryBuilder
  builder.select = jest.fn(() => builder)
  builder.eq = jest.fn(() => builder)
  builder.in = jest.fn(() => builder)
  builder.maybeSingle = jest.fn(() => Promise.resolve(result))
  builder.then = (resolve) => Promise.resolve(result).then(resolve)
  return builder
}

describe('GET /api/athlete/events/detail', () => {
  it('reuses the authorized team membership when resolving availability', async () => {
    const event = {
      id: 'event-1', title: 'Allenamento', description: null, start_date: '2026-09-14T18:00:00.000Z',
      end_date: '2026-09-14T20:00:00.000Z', location: null, event_type: 'training', requires_confirmation: true,
      confirmation_deadline: null, gym_id: null, created_by: null,
    }
    const dataClient = {
      from: jest.fn((table: string) => {
        if (table === 'event_teams') return query({ data: [{ team_id: 'team-1' }] })
        if (table === 'team_members') return query({ data: [{ team_id: 'team-1' }] })
        if (table === 'events') return query({ data: event })
        if (table === 'teams') return query({ data: [{ id: 'team-1', name: 'U16', code: 'U16' }] })
        if (table === 'event_attendances') return query({ data: null })
        throw new Error(`unexpected table ${table}`)
      }),
    }
    createClientMock.mockResolvedValue({} as Awaited<ReturnType<typeof createClient>>)
    createAdminClientMock.mockReturnValue({ from: jest.fn(() => query({ data: null })) } as never)
    subjectMock.mockResolvedValue({
      profileId: 'subject-1', dataClient, activeTeamIds: ['team-1'],
      permissions: { view_schedule: true, confirm_attendance: true },
    } as never)
    availabilityMock.mockResolvedValue({ availabilityByEventId: new Map(), events: [], authorizedTeamIds: [], attendanceByEventId: new Map(), nextEvent: null })

    const response = await GET({ url: 'http://localhost/api/athlete/events/detail?id=event-1' } as NextRequest)

    expect(response).toEqual(expect.objectContaining({ status: 200 }))
    expect(availabilityMock).toHaveBeenCalledWith(
      dataClient,
      'subject-1',
      expect.anything(),
      ['event-1'],
      expect.any(Date),
      ['team-1'],
      undefined,
      ['team-1'],
    )
  })
})
