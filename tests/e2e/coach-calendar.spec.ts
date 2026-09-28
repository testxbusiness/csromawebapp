import { expect, test, type Page } from '@playwright/test'
import { e2eEnv } from './test-env'

const coachEmail = e2eEnv('E2E_COACH_EMAIL')
const coachPassword = e2eEnv('E2E_COACH_PASSWORD')

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(coachEmail!)
  await page.getByLabel('Password').fill(coachPassword!)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await page.waitForURL(/\/dashboard/, { waitUntil: 'domcontentloaded', timeout: 60_000 })
}

test.describe('coach calendar responsive gate', () => {
  test.beforeEach(() => {
    test.skip(!coachEmail || !coachPassword, 'Set E2E_COACH_EMAIL and E2E_COACH_PASSWORD to run coach calendar checks.')
  })

  test('preserves the desktop month default and mobile month calendar', async ({ page }) => {
    await login(page)

    for (const viewport of [
      { width: 320, height: 568 },
      { width: 375, height: 812 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport)
      await page.goto('/coach/calendar', { waitUntil: 'domcontentloaded', timeout: 60_000 })
      await expect(page.getByRole('heading', { name: 'Gestione Calendario', exact: true })).toBeVisible({ timeout: 60_000 })
      if (viewport.width < 768) {
        await expect(page.getByLabel('Calendario mensile')).toBeVisible({ timeout: 60_000 })
      } else {
        await expect(page.locator('.fc-daygrid')).toBeVisible({ timeout: 60_000 })
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    }

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.evaluate(() => document.documentElement.classList.add('theme-dark'))
    await expect(page.getByLabel('Calendario mensile')).toBeHidden()
  })

})
