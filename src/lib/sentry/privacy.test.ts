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
      exception: { values: [{ type: 'Error', value: message, stacktrace: { frames: [{ filename: 'src/app.ts', vars: { email: 'athlete@example.com' }, context_line: 'token=private' }] } }] },
  }
}

describe('sanitizeSentryEvent', () => {
  it('removes identity, request data and free-form values before transmission', () => {
    const sanitized = sanitizeSentryEvent(eventWithMessage('Private message content'), {} as EventHint)

    expect(sanitized).toMatchObject({
      message: 'Application error',
      exception: { values: [{ type: 'Error', value: 'Application error' }] },
      contexts: { trace: { trace_id: 'safe-trace', span_id: 'safe-span' } },
    })
    expect(sanitized?.user).toBeUndefined()
    expect(sanitized?.request).toBeUndefined()
    expect(sanitized?.server_name).toBeUndefined()
    expect(sanitized?.extra).toBeUndefined()
    expect(sanitized?.tags).toEqual({})
    expect(sanitized?.transaction).toBeUndefined()
    expect(sanitized?.breadcrumbs).toEqual([])
    expect(sanitized?.exception?.values?.[0].stacktrace?.frames?.[0]).toMatchObject({ filename: 'src/app.ts' })
    expect(sanitized?.exception?.values?.[0].stacktrace?.frames?.[0].vars).toBeUndefined()
    expect(sanitized?.exception?.values?.[0].stacktrace?.frames?.[0].context_line).toBeUndefined()
  })

  it('drops expected Supabase 4xx errors while retaining server failures', () => {
    const expectedAuthError = eventWithMessage('Invalid credentials')
    expectedAuthError.exception!.values![0].mechanism = { type: 'auto.db.supabase.auth' }
    expect(sanitizeSentryEvent(expectedAuthError, { originalException: { status: 401 } } as EventHint)).toBeNull()

    const serverError = eventWithMessage('Internal database error')
    serverError.exception!.values![0].mechanism = { type: 'auto.db.supabase' }
    expect(sanitizeSentryEvent(serverError, { originalException: { status: 500 } } as EventHint)).not.toBeNull()

    const rateLimited = eventWithMessage('Rate limited')
    rateLimited.exception!.values![0].mechanism = { type: 'auto.db.supabase.auth' }
    expect(sanitizeSentryEvent(rateLimited, { originalException: { status: 429 } } as EventHint)).toBeNull()

    const expectedConflict = eventWithMessage('duplicate key')
    expectedConflict.exception!.values![0].mechanism = { type: 'auto.db.supabase.postgres' }
    expect(sanitizeSentryEvent(expectedConflict, { originalException: { code: '23505' } } as EventHint)).toBeNull()
  })
})

describe('Sentry event privacy', () => {
  it('retains only allowlisted static functional tags and removes personal fields', () => {
    const event = {
      user: { email: 'private@example.test' }, request: { url: 'https://example.test/?token=secret' },
      tags: { feature: 'messages', operation: 'read', runtime: 'server', route: '/athlete/alice', email: 'private@example.test' },
      message: 'message body private', extra: { payload: 'secret' }, breadcrumbs: [{ message: 'personal text' }],
    } as unknown as ErrorEvent
    const sanitized = sanitizeSentryEvent(event, { originalException: new Error('private') } as EventHint)
    expect(sanitized?.tags).toEqual({ feature: 'messages', operation: 'read', runtime: 'server' })
    expect(sanitized?.user).toBeUndefined()
    expect(sanitized?.request).toBeUndefined()
    expect(JSON.stringify(sanitized)).not.toContain('private@example.test')
    expect(JSON.stringify(sanitized)).not.toContain('secret')
  })

  it('keeps trace correlation IDs but drops free-form trace data', () => {
    const event = {
      contexts: { trace: { trace_id: 'trace-id', span_id: 'span-id', op: 'http.server', description: '/athlete/private-id', data: { email: 'private@example.test' } } },
    } as unknown as ErrorEvent
    const sanitized = sanitizeSentryEvent(event, {} as EventHint)
    expect(sanitized?.contexts?.trace).toEqual({ trace_id: 'trace-id', span_id: 'span-id', op: 'http.server' })
  })
})
