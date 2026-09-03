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

test.describe('athlete calendar responsive and accessible views', () => {
  test.beforeEach(() => {
    test.skip(!athleteEmail || !athletePassword, 'Set E2E_ATHLETE_EMAIL and E2E_ATHLETE_PASSWORD to run athlete calendar checks.')
  })

  test('opens the desktop weekly agenda and keeps month view available', async ({ page }) => {
    await login(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/athlete/calendar')

    await expect(page.getByRole('heading', { name: 'Gestione Calendario', exact: true })).toBeVisible()
    await expect(page.locator('.fc-timegrid')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: 'Settimana', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mese', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  })

  test('keeps the compact agenda usable on mobile without horizontal overflow', async ({ page }) => {
    await login(page)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/athlete/calendar')

    await expect(page.getByLabel('Agenda eventi')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: 'Agenda', exact: true })).toHaveAttribute('aria-pressed', 'true')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  })
})
