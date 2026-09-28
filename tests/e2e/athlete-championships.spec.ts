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

test.describe('athlete championships responsive and accessible states', () => {
  test.beforeEach(() => {
    test.skip(!athleteEmail || !athletePassword, 'Set E2E_ATHLETE_EMAIL and E2E_ATHLETE_PASSWORD to run athlete championship checks.')
  })

  test('keeps the single Campionato heading and avoids overflow across required viewports', async ({ page }) => {
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
      await page.goto('/athlete/campionati')
      await expect(page.getByRole('heading', { name: 'Campionato', exact: true })).toHaveCount(1)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    }
  })

  test('keeps championship and group controls labelled when ambiguity requires selectors', async ({ page }) => {
    await login(page)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/athlete/campionati')

    const championshipSelect = page.locator('#athlete-championship-select')
    const groupSelect = page.locator('#athlete-group-select')
    if (await championshipSelect.count()) await expect(championshipSelect).toHaveAccessibleName('Campionato')
    if (await groupSelect.count()) await expect(groupSelect).toHaveAccessibleName('Girone')
  })
})
