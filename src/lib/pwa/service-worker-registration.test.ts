import { checkForServiceWorkerUpdate, clearPwaClientState, clearPwaRuntimeCaches, fetchAppVersion } from './service-worker-registration'

describe('PWA client state', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { controller: { postMessage: jest.fn() } },
    })
  })

  it('clears account-specific subject/team state without clearing the theme', () => {
    window.localStorage.setItem('csroma-theme', 'dark')
    window.localStorage.setItem('csroma_active_subject_profile_id', 'athlete-1')
    window.localStorage.setItem('csroma_team_context:family:athlete-1', 'team-1')
    window.localStorage.setItem('unrelated-preference', 'keep')
    window.sessionStorage.setItem('csroma_profile_cache', '{"profile":{}}')

    clearPwaClientState()

    expect(window.localStorage.getItem('csroma-theme')).toBe('dark')
    expect(window.localStorage.getItem('csroma_active_subject_profile_id')).toBeNull()
    expect(window.localStorage.getItem('csroma_team_context:family:athlete-1')).toBeNull()
    expect(window.localStorage.getItem('unrelated-preference')).toBe('keep')
    expect(window.sessionStorage.getItem('csroma_profile_cache')).toBeNull()
  })

  it('asks the active worker to clear runtime caches', () => {
    clearPwaRuntimeCaches()
    expect(navigator.serviceWorker.controller?.postMessage).toHaveBeenCalledWith({ type: 'CLEAR_RUNTIME_CACHES' })
  })

  it('checks an existing worker for a newer version', async () => {
    const registration = { update: jest.fn().mockResolvedValue(undefined) } as unknown as ServiceWorkerRegistration

    await expect(checkForServiceWorkerUpdate(registration)).resolves.toBe(registration)
    expect(registration.update).toHaveBeenCalledTimes(1)
  })

  it('treats a failed update check as non-fatal', async () => {
    const registration = { update: jest.fn().mockRejectedValue(new Error('offline')) } as unknown as ServiceWorkerRegistration

    await expect(checkForServiceWorkerUpdate(registration)).resolves.toBeNull()
  })

  it('reads the current deployment version without caching it', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ version: 'deploy-123' }) }) as jest.Mock

    await expect(fetchAppVersion()).resolves.toBe('deploy-123')
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/app-version\?t=/), {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
  })
})
