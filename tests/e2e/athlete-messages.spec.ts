import { expect, test, type Page } from '@playwright/test'
import { e2eEnv } from './test-env'

const athleteEmail = e2eEnv('E2E_ATHLETE_EMAIL')
const athletePassword = e2eEnv('E2E_ATHLETE_PASSWORD')

async function login(page: Page, email = athleteEmail, password = athletePassword) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email!)
  await page.getByLabel('Password').fill(password!)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await page.waitForURL(/\/dashboard/)
}

test.describe('athlete messages deep links and responsive behavior', () => {
  test.beforeEach(() => {
    test.skip(!athleteEmail || !athletePassword, 'Set E2E_ATHLETE_EMAIL and E2E_ATHLETE_PASSWORD to run athlete message checks.')
  })

  test('opens an authorized message route without treating the query as authorization', async ({ page }) => {
    await login(page)
    await page.goto('/athlete/messages?messageId=not-a-message-id')
    await expect(page.getByRole('heading', { name: 'Messaggi', level: 1, exact: true })).toBeVisible()
    await expect(page.getByText('Il messaggio non è disponibile o non hai accesso a questa comunicazione.')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  })

  test('keeps filters and list controls accessible on mobile', async ({ page }) => {
    await login(page)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/athlete/messages')
    await expect(page.getByRole('heading', { name: 'Messaggi', level: 1, exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /Tutti/ })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: /Non letti/ })).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByRole('group', { name: 'Filtro lettura' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  })

  test('does not make private API payloads cacheable while the message route is open', async ({ page }) => {
    await login(page)
    await page.goto('/athlete/messages')
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    const cachedUrls = await page.evaluate(async () => {
      const names = await caches.keys()
      const entries = await Promise.all(names.map(async (name) => {
        const cache = await caches.open(name)
        return (await cache.keys()).map((request) => request.url)
      }))
      return entries.flat()
    })
    expect(cachedUrls.some((url) => /\/api\/athlete\/messages|message-attachments|supabase/i.test(url))).toBe(false)
  })
})

test.describe('family subject context for messages', () => {
  test('reloads message data for the selected subject and sends only the subject context', async ({ page }) => {
    const email = e2eEnv('E2E_GENITORE_EMAIL')
    const password = e2eEnv('E2E_GENITORE_PASSWORD')
    test.skip(!email || !password, 'Family E2E credentials are not configured')

    await login(page, email, password)
    await page.getByRole('link', { name: 'Area familiare', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Area familiare', exact: true })).toBeVisible()

    const subjectSelect = page.locator('.cs-subject-switcher select:visible').first()
    const options = await subjectSelect.locator('option').evaluateAll((items) => items.map((item) => ({ value: (item as HTMLOptionElement).value, label: item.textContent })))
    const subject = options.find((option) => option.value)
    test.skip(!subject, 'No accessible athlete subject is available for this account')

    await subjectSelect.selectOption(subject!.value)
    const messageRequest = page.waitForRequest((request) => request.url().includes('/api/athlete/messages'))
    await page.goto('/athlete/messages')
    const request = await messageRequest
    const url = new URL(request.url())
    expect(url.searchParams.get('subjectProfileId')).toBe(subject!.value)
    expect(url.searchParams.get('teamId')).toBeNull()
  })
})
