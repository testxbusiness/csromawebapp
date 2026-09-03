import { expect, test, type Locator, type Page } from '@playwright/test'
import { e2eEnv } from './test-env'

const athleteEmail = e2eEnv('E2E_ATHLETE_EMAIL')
const athletePassword = e2eEnv('E2E_ATHLETE_PASSWORD')
const viewports = [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
]

async function login(page: Page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto('/login')
    await page.getByLabel('Email').fill(athleteEmail!)
    await page.getByLabel('Password').fill(athletePassword!)
    const loginResponsePromise = page.waitForResponse((response) => response.url().endsWith('/api/auth/login'))
    await page.getByRole('button', { name: 'Accedi' }).click()
    const loginResponse = await loginResponsePromise
    expect(loginResponse.status()).toBe(200)

    try {
      await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
      return
    } catch {
      if (attempt === 2) throw new Error('Login atleta completato dall’API, ma la sessione non ha raggiunto /dashboard dopo 3 tentativi.')
    }
  }
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => {
    const width = document.documentElement.clientWidth
    return document.documentElement.scrollWidth <= width + 1 && document.body.scrollWidth <= width + 1
  })).toBe(true)
}

async function expectTouchTargets(locator: Locator) {
  const sizes = await locator.evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  }))
  expect(sizes.length).toBeGreaterThan(0)
  expect(sizes.every(({ width, height }) => width >= 44 && height >= 44)).toBe(true)
}

test.describe('athlete Quote e Profilo responsive smoke', () => {
  test.describe.configure({ timeout: 120_000 })

  test.beforeEach(() => {
    test.skip(!athleteEmail || !athletePassword, 'Set E2E_ATHLETE_EMAIL and E2E_ATHLETE_PASSWORD to run athlete Quote/Profile checks.')
  })

  test('renders Quote e Profilo on all required viewports', async ({ page }) => {
    await login(page)

    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      await page.goto('/athlete/profile')
      await expect(page.locator('p', { hasText: 'Profilo atleta' }).first()).toBeVisible({ timeout: 30_000 })
      await expect(page.getByRole('heading', { name: 'Contatti' })).toBeVisible({ timeout: 30_000 })
      await expect(page.getByRole('heading', { name: 'Impostazioni e sicurezza' })).toBeVisible({ timeout: 30_000 })
      await expect(page.getByRole('heading', { name: 'Notifiche e app' })).toBeVisible({ timeout: 30_000 })
      await expect(page.getByText('Accesso rapido e notifiche dal dispositivo.')).toBeVisible({ timeout: 30_000 })
      await expect(page.getByText('Accesso ai documenti')).toHaveCount(0)
      await expectNoHorizontalOverflow(page)

      const notificationsButton = page.getByRole('button', { name: 'Notifiche' })
      await notificationsButton.focus()
      await expect(notificationsButton).toBeFocused()
    }

    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      await page.goto('/athlete/fees')
      await expect(page.getByRole('heading', { name: 'Quote Associative', level: 1 })).toBeVisible({ timeout: 30_000 })
      await expect(page.getByRole('heading', { name: 'Situazione economica' })).toBeVisible({ timeout: 30_000 })

      const filterGroup = page.getByRole('group', { name: 'Filtra quote' })
      await expect(filterGroup).toBeVisible()
      await expectTouchTargets(filterGroup.getByRole('button'))

      const pendingFilter = filterGroup.getByRole('button', { name: /Da pagare/ })
      await pendingFilter.focus()
      await expect(pendingFilter).toBeFocused()
      await page.keyboard.press('Space')
      await expect(pendingFilter).toHaveAttribute('aria-pressed', 'true')
      await expectNoHorizontalOverflow(page)
    }
  })
})
