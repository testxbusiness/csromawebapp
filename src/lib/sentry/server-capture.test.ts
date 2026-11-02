import * as Sentry from '@sentry/nextjs'
import { captureSupabaseError, captureUnexpectedServerError } from './server-capture'
import { runSdkOwnedOperation } from './sdk-owned-error'

const mockSetTag = jest.fn()
const mockSetFingerprint = jest.fn()
jest.mock('@sentry/nextjs', () => ({
  withScope: (callback: (scope: { setTag: jest.Mock; setFingerprint: jest.Mock }) => void) => callback({ setTag: mockSetTag, setFingerprint: mockSetFingerprint }),
  captureException: jest.fn(),
}))

describe('operational Sentry capture', () => {
  beforeEach(() => jest.clearAllMocks())

  it('captures unexpected Supabase errors as a static sanitized exception', () => {
    captureSupabaseError({ code: 'XX000', message: 'private table/payload alice@example.test' }, 'messages', 'read', 'server', false)
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.objectContaining({ message: 'Unexpected messages operation failure' }))
    expect(JSON.stringify(jest.mocked(Sentry.captureException).mock.calls)).not.toContain('alice@example.test')
  })

  it.each([
    { error: { status: 401 }, label: 'invalid credentials' },
    { error: { status: 403 }, label: 'permission denied' },
    { error: { status: 422 }, label: 'validation' },
    { error: { code: 'P0001', message: 'early_absence_event_closed' }, label: 'cancelled domain operation' },
    { error: { code: 'ECONNRESET' }, label: 'connectivity' },
    { error: new TypeError('fetch failed'), label: 'connectivity' },
  ])('excludes expected errors ($label)', ({ error }) => {
    captureUnexpectedServerError(error, 'auth', 'login')
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('deduplicates repeated capture of the same error object', () => {
    const error = new Error('private content')
    captureUnexpectedServerError(error, 'convocations', 'update')
    captureUnexpectedServerError(error, 'convocations', 'update')
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
  })

  it('uses allowlisted tags and leaves grouping to the original stack', () => {
    const error = new Error('private stack message')
    captureUnexpectedServerError(error, 'messages', 'read')
    expect(mockSetTag.mock.calls).toEqual([
      ['feature', 'messages'], ['operation', 'read'], ['runtime', 'server'],
    ])
    expect(mockSetFingerprint).not.toHaveBeenCalled()
    expect((jest.mocked(Sentry.captureException).mock.calls[0][0] as Error).stack).toBe(error.stack)
  })

  it('leaves instrumented Supabase result errors to the SDK owner', () => {
    captureSupabaseError({ code: 'XX000', message: 'private payload' }, 'messages', 'read', 'server', true)
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('does not recapture an SDK-owned rejected Auth operation in the Route Handler catch', async () => {
    const error = new Error('SDK-owned Auth operation rejection')
    await expect(runSdkOwnedOperation(async () => { throw error })).rejects.toBe(error)
    captureUnexpectedServerError(error, 'auth', 'login')
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('does not report expected 429 or user-cancelled requests', () => {
    captureSupabaseError({ status: 429, message: 'rate limited' }, 'auth', 'login', 'server', false)
    captureUnexpectedServerError(Object.assign(new Error('cancelled'), { name: 'AbortError' }), 'messages', 'read', 'client')
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })
})
