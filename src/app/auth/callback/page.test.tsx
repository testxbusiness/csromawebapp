import { act, render, screen, waitFor } from '@testing-library/react'
import { createBrowserClient } from '@supabase/ssr'
import AuthCallbackPage from './page'
import { createClient } from '@/lib/supabase/client'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/sentry/server-capture', () => ({
  captureSupabaseError: jest.fn(),
  captureUnexpectedServerError: jest.fn(),
}))

const session = {
  access_token: 'access-token-test',
  refresh_token: 'refresh-token-test',
  user: { id: 'test-user', app_metadata: {} },
}

function installLocation(href: string) {
  const replace = jest.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { href, hash: new URL(href).hash, pathname: new URL(href).pathname, replace },
  })
  return replace
}

function installAuth(overrides: {
  getSession?: jest.Mock
  setSession?: jest.Mock
} = {}) {
  const getSession = overrides.getSession ?? jest.fn().mockResolvedValue({ data: { session }, error: null })
  const setSession = overrides.setSession ?? jest.fn().mockResolvedValue({ data: { session }, error: null })
  ;(createClient as jest.Mock).mockReturnValue({ auth: { getSession, setSession } })
  return { getSession, setSession }
}

describe('Auth callback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.history.replaceState({}, '', '/')
  })

  it('accepts PKCE completed by the SDK after it removes code from the URL', async () => {
    const replace = installLocation('http://localhost/auth/callback?code=one-time-code')
    const getSession = jest.fn().mockImplementation(async () => {
      window.location.href = 'http://localhost/auth/callback'
      return { data: { session }, error: null }
    })
    installAuth({ getSession })

    render(<AuthCallbackPage />)

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/reset-password?recovery=1'))
    expect(getSession).toHaveBeenCalledTimes(1)
  })

  it('accepts a PKCE code still present when SDK initialization finishes its exchange', async () => {
    const replace = installLocation('http://localhost/auth/callback?code=one-time-code&next=%2Freset-password%3Frecovery%3D1')
    const getSession = jest.fn().mockImplementation(async () => {
      window.location.href = 'http://localhost/auth/callback?next=%2Freset-password%3Frecovery%3D1'
      return { data: { session }, error: null }
    })
    installAuth({ getSession })

    render(<AuthCallbackPage />)

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/reset-password?recovery=1'))
  })

  it('rejects a code without a verifier even when an unrelated session exists', async () => {
    installLocation('http://localhost/auth/callback?code=code-without-verifier')
    installAuth()

    render(<AuthCallbackPage />)

    expect(await screen.findByText(/Il link di recupero non è valido o è scaduto/)).toBeInTheDocument()
    expect(screen.queryByText(/invito/i)).not.toBeInTheDocument()
  })

  it('does not treat a preexisting session as proof when the callback has no credentials', async () => {
    installLocation('http://localhost/auth/callback')
    const { getSession } = installAuth()

    render(<AuthCallbackPage />)

    expect(await screen.findByText(/Il link è assente o non valido/)).toBeInTheDocument()
    expect(getSession).not.toHaveBeenCalled()
  })

  it('rejects a one-time link already used or expired and offers a new recovery link', async () => {
    installLocation('http://localhost/auth/callback?error=access_denied&error_code=otp_expired')
    const { getSession, setSession } = installAuth()

    render(<AuthCallbackPage />)

    expect(await screen.findByText(/scaduto, è già stato utilizzato o non è valido/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Richiedi un nuovo link' })).toHaveAttribute('href', '/forgot-password')
    expect(getSession).not.toHaveBeenCalled()
    expect(setSession).not.toHaveBeenCalled()
  })

  it('shows the recovery error returned by Supabase without invite wording', async () => {
    installLocation('http://localhost/auth/callback?error_description=Email+link+is+invalid+or+has+expired')
    installAuth()
    render(<AuthCallbackPage />)

    expect(await screen.findByText(/Puoi richiedere un nuovo link di recupero password/)).toBeInTheDocument()
    expect(screen.queryByText(/invito/i)).not.toBeInTheDocument()
  })

  it('rejects implicit tokens that the SDK did not consume', async () => {
    installLocation('http://localhost/auth/callback#access_token=invalid&refresh_token=invalid&type=recovery')
    installAuth()
    render(<AuthCallbackPage />)

    expect(await screen.findByText(/Il link non è valido o è scaduto/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Richiedi un nuovo link' })).toHaveAttribute('href', '/forgot-password')
  })

  it.each([
    ['invite implicit', 'type=invite'],
    ['admin recovery implicit', 'type=recovery'],
  ])('preserves %s token flow', async (_name, type) => {
    const hash = `#access_token=access-token-test&refresh_token=refresh-token-test&${type}`
    const replace = installLocation(`http://localhost/auth/callback${hash}`)
    const getSession = jest.fn().mockImplementation(async () => {
      window.location.href = 'http://localhost/auth/callback'
      return { data: { session }, error: null }
    })
    const { setSession } = installAuth({ getSession })

    render(<AuthCallbackPage />)

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/reset-password?recovery=1'))
    expect(getSession).toHaveBeenCalledTimes(1)
    expect(setSession).not.toHaveBeenCalled()
    expect(screen.queryByText(/invito/i)).not.toBeInTheDocument()
  })

  it('persists the accepted session for the next reset-password read', async () => {
    const replace = installLocation('http://localhost/auth/callback#access_token=access-token-test&refresh_token=refresh-token-test&type=recovery')
    let persistedSession = null as typeof session | null
    const getSession = jest.fn().mockImplementation(async () => {
      persistedSession = session
      document.cookie = 'sb-test-auth-token=persisted; path=/'
      window.location.href = 'http://localhost/auth/callback'
      return { data: { session }, error: null }
    })
    const readResetPageSession = jest.fn().mockImplementation(async () => ({ data: { session: persistedSession }, error: null }))
    installAuth({ getSession })

    render(<AuthCallbackPage />)
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/reset-password?recovery=1'))

    expect(document.cookie).toContain('sb-test-auth-token=persisted')
    await act(async () => {
      await readResetPageSession()
    })
    expect(readResetPageSession).toHaveBeenCalledTimes(1)
    expect(persistedSession?.user.id).toBe('test-user')
  })

  it('stores an implicit session in browser cookies and makes it readable by a new reset-page client', async () => {
    document.cookie = 'sb-test-auth-token=; path=/; max-age=0'
    const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    const accessToken = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600, sub: 'test-user', aud: 'authenticated' })}.c2ln`
    const user = {
      id: 'test-user',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'test@example.test',
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-01-01T00:00:00.000Z',
    }
    const previousFetch = global.fetch
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: { get: jest.fn(() => 'application/json') },
      json: async () => user,
      text: async () => JSON.stringify(user),
    })
    global.fetch = fetchMock
    const options = {
      isSingleton: false,
      cookieOptions: { name: 'sb-test-auth-token' },
      auth: { autoRefreshToken: false, detectSessionInUrl: false },
    }

    try {
      const callbackClient = createBrowserClient('http://127.0.0.1:54321', 'test-anon-key', options)
      const result = await callbackClient.auth.setSession({ access_token: accessToken, refresh_token: 'refresh-token-test' })
      expect(result.error).toBeNull()
      expect(document.cookie).toContain('sb-test-auth-token')

      const resetPasswordClient = createBrowserClient('http://127.0.0.1:54321', 'test-anon-key', options)
      const resetPageSession = await resetPasswordClient.auth.getSession()
      expect(resetPageSession.data.session?.user.id).toBe('test-user')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      global.fetch = previousFetch
      document.cookie = 'sb-test-auth-token=; path=/; max-age=0'
    }
  })

  it('shows a recoverable error when opened without callback parameters', async () => {
    installLocation('http://localhost/auth/callback')
    installAuth()
    render(<AuthCallbackPage />)

    expect(await screen.findByRole('link', { name: 'Richiedi un nuovo link' })).toHaveAttribute('href', '/forgot-password')
  })
})
