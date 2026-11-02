/** @jest-environment node */

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(), createAdminClient: jest.fn() }))

import * as Sentry from '@sentry/nextjs'
import type { Envelope, Transport, TransportMakeRequestResponse } from '@sentry/core'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ErrorEvent } from '@sentry/nextjs'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { POST as loginPost } from '@/app/api/auth/login/route'
import { captureSupabaseError, withSentryOperation } from './server-capture'
import { sanitizeSentryEvent } from './privacy'

const events: ErrorEvent[] = []

function sentryTransport(): Transport {
  return {
    send: async (envelope: Envelope): Promise<TransportMakeRequestResponse> => {
      for (const [headers, payload] of envelope[1]) {
        if (headers.type === 'event') events.push(payload as ErrorEvent)
      }
      return { statusCode: 200, headers: { 'x-sentry-rate-limits': null, 'retry-after': null } }
    },
    flush: async () => true,
  }
}

beforeAll(() => {
  Sentry.init({
    dsn: 'https://public@example.ingest.sentry.io/1',
    environment: 'test',
    tracesSampleRate: 1,
    beforeSend: sanitizeSentryEvent,
    transport: () => sentryTransport(),
  })
})

beforeEach(() => {
  events.length = 0
})

afterAll(async () => {
  await Sentry.close(1000)
})

function makeClient(fetchImpl: typeof fetch) {
  const client = createClient('https://project-ref.supabase.co', 'public-anon-key', {
    global: { fetch: fetchImpl },
  })
  Sentry.instrumentSupabaseClient(client)
  return client
}

async function readMessages(
  responseStatus: number,
  error: { code: string; message: string; details?: string } | null,
) {
  let activeSpanAtFetch: unknown
  const client = makeClient(async () => {
    activeSpanAtFetch = Sentry.getActiveSpan()
    return new Response(error ? JSON.stringify(error) : JSON.stringify([{ id: 'message-1' }]), {
      status: responseStatus,
      headers: { 'content-type': 'application/json' },
    })
  })

  const handler = withSentryOperation('messages', 'read', async () => {
    const { data, error: queryError } = await client.from('messages').select('id')
    if (queryError) captureSupabaseError(queryError, 'messages', 'read', 'server', true)
    return new Response(JSON.stringify(queryError ? { error: 'Impossibile caricare i messaggi' } : { data }), {
      status: queryError?.code === '23505' ? 409 : queryError ? 500 : 200,
      headers: { 'content-type': 'application/json' },
    })
  })

  const response = await handler()
  await Sentry.flush(1000)
  return { response, activeSpanAtFetch }
}

describe('SDK-owned Supabase error capture', () => {
  it('sends one tagged, sanitized event and preserves the application response for an unexpected error', async () => {
    const { response, activeSpanAtFetch } = await readMessages(500, {
      code: 'XX000',
      message: 'database failed for athlete@example.test',
      details: 'private athlete row data',
    })

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Impossibile caricare i messaggi' })
    expect(events).toHaveLength(1)
    expect(events[0].tags).toMatchObject({ feature: 'messages', operation: 'read', runtime: 'server' })
    expect(JSON.stringify(events[0])).not.toContain('athlete@example.test')
    expect(JSON.stringify(events[0])).not.toContain('private athlete row data')
    expect(events[0].fingerprint).toBeUndefined()
    expect(activeSpanAtFetch).toBeDefined()
    expect(events[0].contexts?.trace?.trace_id).toBeDefined()
  })

  it('sends no operational event for a simulated expected SQL conflict', async () => {
    const { response } = await readMessages(409, {
      code: '23505',
      message: 'duplicate key for athlete@example.test',
    })

    expect(response.status).toBe(409)
    expect(events).toHaveLength(0)
  })

  it('sends no error event for success and keeps distinct failures free of a custom grouping fingerprint', async () => {
    const success = await readMessages(200, null)
    expect(success.response.status).toBe(200)
    expect(events).toHaveLength(0)

    await readMessages(500, { code: 'XX001', message: 'failure one' })
    await readMessages(500, { code: 'XX002', message: 'failure two' })
    expect(events).toHaveLength(2)
    expect(events.map((event) => event.fingerprint)).toEqual([undefined, undefined])
  })
})

describe('instrumented Supabase in the login Route Handler', () => {
  const user = {
    id: 'auth-user-1', aud: 'authenticated', role: 'authenticated', email: 'athlete@example.test',
    app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {},
    created_at: '2026-01-01T00:00:00.000Z',
  }

  function routeClient(profileStatus: number) {
    const session = {
      access_token: 'private-access-token', token_type: 'bearer', expires_in: 3600,
      refresh_token: 'private-refresh-token', user,
    }
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.pathname.endsWith('/auth/v1/token')) return new Response(JSON.stringify(session), { status: 200 })
      if (url.pathname.endsWith('/auth/v1/user')) return new Response(JSON.stringify(user), { status: 200 })
      if (url.pathname.endsWith('/rest/v1/app_accounts')) return new Response(JSON.stringify({
        auth_user_id: user.id, owner_profile_id: 'profile-1', status: 'active', must_change_password: false,
      }), { status: 200 })
      if (url.pathname.endsWith('/rest/v1/account_roles')) return new Response(JSON.stringify([{ role: 'athlete' }]), { status: 200 })
      if (url.pathname.endsWith('/rest/v1/profiles')) return new Response(JSON.stringify({
        code: 'XX000', message: 'private profile failure athlete@example.test', details: 'medical data',
      }), { status: profileStatus, headers: { 'content-type': 'application/json' } })
      throw new Error(`Unexpected test request ${url.pathname}`)
    }
    const client = makeClient(fetchImpl)
    jest.mocked(createServerClient).mockResolvedValue(client as Awaited<ReturnType<typeof createServerClient>>)
  }

  it('keeps the Route Handler response while one automatic tagged event owns the PostgREST error', async () => {
    routeClient(500)
    const response = await loginPost(new NextRequest('http://localhost/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'athlete@example.test', password: 'private-password' }),
    }))
    await Sentry.flush(1000)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.profile).toBeNull()
    expect(events).toHaveLength(1)
    expect(events[0].tags).toMatchObject({ feature: 'auth', operation: 'login', runtime: 'server' })
    expect(JSON.stringify(events[0])).not.toContain('athlete@example.test')
    expect(JSON.stringify(events[0])).not.toContain('private-access-token')
    expect(JSON.stringify(events[0])).not.toContain('medical data')
  })

  it('keeps invalid credentials as the normal 401 response without an operational event', async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      return new Response(JSON.stringify({ code: 'invalid_credentials', message: 'Invalid login credentials' }), {
        status: url.pathname.endsWith('/auth/v1/token') ? 400 : 404,
        headers: { 'content-type': 'application/json' },
      })
    }
    jest.mocked(createServerClient).mockResolvedValue(makeClient(fetchImpl) as Awaited<ReturnType<typeof createServerClient>>)
    const response = await loginPost(new NextRequest('http://localhost/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'athlete@example.test', password: 'wrong-password' }),
    }))
    await Sentry.flush(1000)

    expect(response.status).toBe(401)
    expect(events).toHaveLength(0)
  })

  it('keeps an Auth transport outage out of operational events', async () => {
    const fetchImpl: typeof fetch = async () => { throw new Error('private auth transport failure athlete@example.test') }
    jest.mocked(createServerClient).mockResolvedValue(makeClient(fetchImpl) as Awaited<ReturnType<typeof createServerClient>>)
    const response = await loginPost(new NextRequest('http://localhost/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'athlete@example.test', password: 'private-password' }),
    }))
    await Sentry.flush(1000)

    expect(response.status).toBe(401)
    expect(events).toHaveLength(0)
  })
})
