import { sanitizeSentryEvent } from './privacy'
import type { ErrorEvent, EventHint } from '@sentry/nextjs'

function eventWithMessage(message: string): ErrorEvent {
  return {
    type: undefined,
    message,
    transaction: '/reset-password?token=private-token',
    user: { id: 'athlete-id', email: 'athlete@example.com' },
    request: { url: 'https://example.test/reset-password?token=private-token', headers: { cookie: 'session=secret' } },
    server_name: '169.254.45.21',
    extra: { medical_note: 'private data' },
    tags: { profile_id: 'athlete-id' },
    breadcrumbs: [{ message: 'Private message content', timestamp: 1 }],
    contexts: { trace: { trace_id: 'safe-trace', span_id: 'safe-span' }, custom: { note: 'private' } },
    exception: { values: [{ type: 'Error', value: message }] },
  }
}

describe('sanitizeSentryEvent', () => {
  it('removes identity, request data and free-form values before transmission', () => {
    const sanitized = sanitizeSentryEvent(eventWithMessage('Private message content'), {} as EventHint)

    expect(sanitized).toMatchObject({
      message: 'Application error',
      exception: { values: [{ type: 'Error', value: 'Error' }] },
      contexts: { trace: { trace_id: 'safe-trace', span_id: 'safe-span' } },
    })
    expect(sanitized?.user).toBeUndefined()
    expect(sanitized?.request).toBeUndefined()
    expect(sanitized?.server_name).toBeUndefined()
    expect(sanitized?.extra).toBeUndefined()
    expect(sanitized?.tags).toBeUndefined()
    expect(sanitized?.transaction).toBeUndefined()
    expect(sanitized?.breadcrumbs).toEqual([])
  })

  it('drops expected Supabase 4xx errors while retaining server failures', () => {
    const expectedAuthError = eventWithMessage('Invalid credentials')
    expectedAuthError.exception!.values![0].mechanism = { type: 'auto.db.supabase.auth' }
    expect(sanitizeSentryEvent(expectedAuthError, { originalException: { status: 401 } } as EventHint)).toBeNull()

    const serverError = eventWithMessage('Internal database error')
    serverError.exception!.values![0].mechanism = { type: 'auto.db.supabase' }
    expect(sanitizeSentryEvent(serverError, { originalException: { status: 500 } } as EventHint)).not.toBeNull()
  })
})
