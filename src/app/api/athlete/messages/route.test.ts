import type { NextRequest } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireSubjectAthleteContext } from '@/server/auth/require-subject-profile'
import { GET } from './route'

jest.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(), createAdminClient: jest.fn() }))
jest.mock('@/server/auth/require-subject-profile', () => ({ requireSubjectAthleteContext: jest.fn() }))

type Row = Record<string, unknown>
type QueryBuilder = {
  select: (columns: string) => QueryBuilder
  eq: () => QueryBuilder
  in: () => QueryBuilder
  or: () => QueryBuilder
  order: () => QueryBuilder
  limit: () => QueryBuilder
  then: (resolve: (value: { data: Row[]; error: null }) => unknown) => Promise<unknown>
}

const createClientMock = createClient as jest.MockedFunction<typeof createClient>
const createAdminClientMock = createAdminClient as jest.MockedFunction<typeof createAdminClient>
const subjectContextMock = requireSubjectAthleteContext as jest.MockedFunction<typeof requireSubjectAthleteContext>

function request(search: string) {
  return { url: `http://localhost/api/athlete/messages${search}` } as NextRequest
}

function responseBody(response: { body?: unknown }) {
  return response.body as Record<string, any>
}

function queryFor(data: Row[], calls: Array<{ table: string; select?: string }>, table: string) {
  const builder: QueryBuilder = {
    select: (columns: string) => {
      calls.push({ table, select: columns })
      return builder
    },
    eq: () => builder,
    in: () => builder,
    or: () => builder,
    order: () => builder,
    limit: () => builder,
    then: (resolve: (value: { data: Row[]; error: null }) => unknown) => Promise.resolve(resolve({ data, error: null })),
  }
  return builder
}

function setup() {
  const dataCalls: Array<{ table: string; select?: string }> = []
  const adminCalls: Array<{ table: string; select?: string }> = []
  const rows: Record<string, Row[]> = {
    team_members: [{ team_id: 'team-a' }],
    message_recipients: [
      { id: 'recipient-team', message_id: 'message-1', team_id: 'team-a', profile_id: null },
      { id: 'recipient-self', message_id: 'message-1', team_id: null, profile_id: 'profile-1' },
      { id: 'recipient-other', message_id: 'message-1', team_id: null, profile_id: 'profile-other' },
    ],
    messages: [{ id: 'message-1', subject: 'Avviso', content: 'Test', created_at: '2026-10-09T10:00:00Z', created_by: 'creator-1' }],
    message_reads: [{ message_id: 'message-1', read_at: '2026-10-09T11:00:00Z' }],
    teams: [{ id: 'team-a', name: 'U16', code: 'U16' }],
    profiles: [{ id: 'profile-1', first_name: 'Coach', last_name: 'Roma', email: 'coach@example.test' }],
  }
  const adminRows: Record<string, Row[]> = {
    profiles: [{ id: 'creator-1', first_name: 'Coach', last_name: 'Roma', role: 'coach' }],
    message_attachments: [{ id: 'attachment-1', message_id: 'message-1', file_path: 'private/file.pdf', file_name: 'file.pdf', mime_type: 'application/pdf', file_size: 42 }],
  }

  createClientMock.mockResolvedValue({
    from: jest.fn((table: string) => queryFor(rows[table] ?? [], dataCalls, table)),
  } as unknown as Awaited<ReturnType<typeof createClient>>)
  createAdminClientMock.mockReturnValue({
    from: jest.fn((table: string) => queryFor(adminRows[table] ?? [], adminCalls, table)),
  } as unknown as ReturnType<typeof createAdminClient>)
  const subject = {
    account: { authUserId: 'auth-1', ownerProfileId: 'profile-1', accountStatus: 'active', roles: ['athlete'], mustChangePassword: false },
    profileId: 'profile-1',
    dataClient: { from: jest.fn((table: string) => queryFor(rows[table] ?? [], dataCalls, table)) } as never,
    delegated: false,
    permissions: { view_schedule: true, confirm_attendance: true, view_payments: true, view_medical_status: true, view_documents: true, sign_documents: true, receive_messages: true },
    activeTeamIds: ['team-a'],
  } as Awaited<ReturnType<typeof requireSubjectAthleteContext>>
  subjectContextMock.mockResolvedValue(subject)

  return { dataCalls, adminCalls, subject }
}

describe('athlete messages GET optimization', () => {
  beforeEach(() => jest.clearAllMocks())

  it('keeps countOnly lightweight and does not load message bodies', async () => {
    const { dataCalls } = setup()

    const response = await GET(request('?countOnly=1'))

    expect(response.status).toBe(200)
    expect(responseBody(response)).toEqual({ unreadMessageCount: 0 })
    expect(dataCalls.some((call) => call.table === 'messages')).toBe(false)
    expect(dataCalls.some((call) => call.table === 'message_attachments')).toBe(false)
  })

  it('keeps minimal response and creator enrichment while overlapping independent reads', async () => {
    const { dataCalls, adminCalls } = setup()

    const response = await GET(request('?view=minimal'))
    const payload = responseBody(response)

    expect(response.status).toBe(200)
    expect(payload.messages[0]).toMatchObject({
      id: 'message-1',
      created_by_profile: { id: 'creator-1', first_name: 'Coach', last_name: 'Roma', role: 'coach' },
      teams: [{ id: 'team-a', name: 'U16', code: 'U16' }],
      is_read: true,
    })
    expect(adminCalls.filter((call) => call.table === 'profiles')).toHaveLength(1)
    expect(dataCalls.filter((call) => call.table === 'message_recipients')).toHaveLength(1)
  })

  it('reuses authorized discovery rows for full detail and returns attachment metadata only', async () => {
    const { dataCalls, adminCalls, subject } = setup()
    subject.delegated = true

    const response = await GET(request('?view=full&id=message-1'))
    const payload = responseBody(response)

    expect(response.status).toBe(200)
    expect(dataCalls.filter((call) => call.table === 'message_recipients')).toHaveLength(1)
    expect(payload.messages[0].message_recipients).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'recipient-team', teams: expect.objectContaining({ id: 'team-a', name: 'U16' }) }),
      expect.objectContaining({ id: 'recipient-self', profiles: expect.objectContaining({ id: 'profile-1', first_name: 'Coach', last_name: 'Roma' }) }),
    ]))
    expect(payload.messages[0].message_recipients).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'recipient-other' }),
    ]))
    expect(payload.messages[0].attachments).toEqual([{ id: 'attachment-1', file_name: 'file.pdf', mime_type: 'application/pdf', file_size: 42 }])
    expect(payload.messages[0].attachments[0].download_url).toBeUndefined()
    expect(adminCalls.filter((call) => call.table === 'message_attachments')).toHaveLength(1)
  })

  it('returns not found for an inaccessible full-detail message without broad discovery', async () => {
    const { dataCalls } = setup()

    const response = await GET(request('?view=full&id=not-accessible'))

    expect(response.status).toBe(404)
    expect(dataCalls.filter((call) => call.table === 'messages')).toHaveLength(0)
    expect(dataCalls.filter((call) => call.table === 'message_recipients')).toHaveLength(1)
  })

  it('returns denied without querying recipient or message data', async () => {
    setup()
    subjectContextMock.mockRejectedValueOnce(new AccountContextError('Permesso non concesso', 403))

    const response = await GET(request('?view=minimal'))

    expect(response.status).toBe(403)
    expect(responseBody(response)).toEqual({ error: 'Permesso non concesso' })
  })
})
