import { expect, test, type Page } from '@playwright/test'
import { e2eEnv } from './test-env'

const athleteEmail = e2eEnv('E2E_ATHLETE_EMAIL')
const athletePassword = e2eEnv('E2E_ATHLETE_PASSWORD')

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(athleteEmail!)
  await page.getByLabel('Password').fill(athletePassword!)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await page.waitForURL(/\/dashboard/)
}

test.describe('athlete dashboard responsive and offline gate', () => {
  test.beforeEach(() => {
    test.skip(!athleteEmail || !athletePassword, 'Set E2E_ATHLETE_EMAIL and E2E_ATHLETE_PASSWORD to run athlete dashboard checks.')
  })

  test('has no horizontal overflow at supported dashboard viewports', async ({ page }) => {
    await login(page)

    for (const viewport of [
      { width: 320, height: 800 },
      { width: 375, height: 812 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport)
      await page.goto('/dashboard')
      await expect(page.locator('p.cs-eyebrow', { hasText: 'Area atleta' })).toBeVisible({ timeout: 30_000 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    }
  })

  test('labels the dashboard honestly when the connection is lost', async ({ page, context }) => {
    await login(page)
    await expect(page.locator('p.cs-eyebrow', { hasText: 'Area atleta' })).toBeVisible({ timeout: 30_000 })

    await context.setOffline(true)
    await expect(page.getByText(/Connessione assente|Dashboard non disponibile offline/)).toBeVisible()
    await context.setOffline(false)
  })
})
