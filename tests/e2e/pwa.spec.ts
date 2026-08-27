import { expect, test } from '@playwright/test'

test.describe('PWA foundation', () => {
  test('serves an installable manifest and a root service worker', async ({ request }) => {
    const manifestResponse = await request.get('/manifest.webmanifest')
    expect(manifestResponse.ok()).toBeTruthy()
    expect(manifestResponse.headers()['content-type']).toContain('application/manifest+json')

    const manifest = await manifestResponse.json()
    expect(manifest.name).toBe('CSRoma Control Center')
    expect(manifest.short_name).toBe('CSRoma')
    expect(manifest.start_url).toBe('/dashboard?source=pwa')
    expect(manifest.scope).toBe('/')
    expect(manifest.display).toBe('standalone')
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: '/icons/icon-192.png', sizes: '192x192' }),
      expect.objectContaining({ src: '/icons/icon-512.png', sizes: '512x512' }),
    ]))

    const serviceWorkerResponse = await request.get('/sw.js')
    expect(serviceWorkerResponse.ok()).toBeTruthy()
    expect(serviceWorkerResponse.headers()['content-type']).toContain('javascript')
  })

  test('registers the worker and serves the offline fallback for navigation', async ({ page, context }) => {
    await page.goto('/login')
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await page.reload()

    const registration = await page.evaluate(async () => {
      const worker = await navigator.serviceWorker.ready
      return { scope: worker.scope, scriptURL: worker.active?.scriptURL }
    })
    expect(registration.scope).toContain('/')
    expect(registration.scriptURL).toContain('/sw.js')

    await context.setOffline(true)
    try {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { name: 'Connessione assente' })).toBeVisible()
      await expect(page.getByText(/CSRoma tornerà disponibile/)).toBeVisible()
      await expect(page.locator('img[alt="CSRoma"]')).toHaveJSProperty('naturalWidth', 192)
    } finally {
      await context.setOffline(false)
    }
  })

  test('does not persist private API or Supabase URLs in Cache Storage', async ({ page }) => {
    await page.goto('/login')
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })

    const cachedUrls = await page.evaluate(async () => {
      const cacheNames = await caches.keys()
      const entries = await Promise.all(cacheNames.map(async (name) => {
        const cache = await caches.open(name)
        return (await cache.keys()).map((request) => request.url)
      }))
      return entries.flat()
    })

    expect(cachedUrls.some((url) => /\/api\/|_rsc=|supabase/i.test(url))).toBeFalsy()
  })
})
