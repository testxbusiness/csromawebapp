import { TextEncoder as NodeTextEncoder } from 'util'

const mockPosthog = {
  init: jest.fn(),
  identify: jest.fn(),
  reset: jest.fn(),
  opt_in_capturing: jest.fn(),
  opt_out_capturing: jest.fn(),
  has_opted_out_capturing: jest.fn(() => false),
  capture: jest.fn(),
}

jest.mock('posthog-js', () => ({ __esModule: true, default: mockPosthog }))

describe('athlete analytics client', () => {
  const originalCrypto = globalThis.crypto
  const originalTextEncoder = globalThis.TextEncoder

  beforeEach(() => {
    jest.resetModules()
    Object.values(mockPosthog).forEach((method) => {
      if (typeof method === 'function' && 'mockReset' in method) method.mockReset()
    })
    mockPosthog.has_opted_out_capturing.mockReturnValue(false)
    process.env.NEXT_PUBLIC_POSTHOG_ENABLED = 'true'
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = 'test-project-token'
    process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://eu.i.posthog.com'
    process.env.NEXT_PUBLIC_ANALYTICS_ENV = 'preview'
    Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: NodeTextEncoder })
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        subtle: {
          digest: jest.fn(async (_algorithm: string, value: BufferSource) => {
            const bytes = new Uint8Array(value as ArrayBuffer)
            const result = new Uint8Array(32)
            bytes.forEach((byte, index) => { result[index % result.length] ^= byte })
            return result.buffer
          }),
        },
      },
    })
  })

  afterAll(() => {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: originalCrypto })
    Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: originalTextEncoder })
    delete process.env.NEXT_PUBLIC_POSTHOG_ENABLED
    delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST
    delete process.env.NEXT_PUBLIC_ANALYTICS_ENV
  })

  it('uses distinct hashed identities and resets between accounts', async () => {
    const { startAthleteAnalytics } = require('./athlete-analytics') as typeof import('./athlete-analytics')
    expect(await startAthleteAnalytics('auth-user-a')).toBe(true)
    expect(await startAthleteAnalytics('auth-user-b')).toBe(true)

    const firstIdentity = mockPosthog.identify.mock.calls[0][0]
    const secondIdentity = mockPosthog.identify.mock.calls[1][0]
    expect(firstIdentity).toMatch(/^sha256:/)
    expect(secondIdentity).toMatch(/^sha256:/)
    expect(firstIdentity).not.toBe(secondIdentity)
    expect(String(firstIdentity)).not.toContain('auth-user-a')
    expect(String(secondIdentity)).not.toContain('auth-user-b')
    expect(mockPosthog.reset).toHaveBeenCalledTimes(1)
  })

  it('filters SDK defaults and personal properties before events leave the browser', async () => {
    const { startAthleteAnalytics, trackAthleteEvent, trackAthletePageView, stopAthleteAnalytics } = require('./athlete-analytics') as typeof import('./athlete-analytics')
    await startAthleteAnalytics('auth-user-a')
    const config = mockPosthog.init.mock.calls[0][1] as { before_send: (event: { event: string; properties: Record<string, unknown> }) => unknown }
    const filtered = config.before_send({
      event: '$pageview',
      properties: {
        page: 'fees',
        environment: 'preview',
        '$current_url': 'https://preview.example/athlete/fees?token=private',
        '$referrer': 'https://example.test/?secret=yes',
        '$geoip_country_name': 'Italy',
      },
    }) as { properties: Record<string, unknown> }
    expect(filtered.properties).toEqual({ page: 'fees', environment: 'preview', '$geoip_disable': true })
    expect(config.before_send({ event: '$autocapture', properties: { text: 'private' } })).toBeNull()

    trackAthletePageView('fees')
    expect(mockPosthog.capture).toHaveBeenCalledWith('$pageview', { page: 'fees', environment: 'preview' })
    trackAthleteEvent({ event: 'athlete_absence_reported', properties: { scope: 'period' } })
    expect(mockPosthog.capture).toHaveBeenCalledWith('athlete_absence_reported', { scope: 'period', environment: 'preview' })
    stopAthleteAnalytics()
    mockPosthog.capture.mockClear()
    trackAthletePageView('fees')
    expect(mockPosthog.capture).not.toHaveBeenCalled()
    expect(mockPosthog.opt_out_capturing).toHaveBeenCalled()
  })
})
