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

test('opens the selected day agenda through a touch interaction', async ({ page }) => {
  test.skip(!coachEmail || !coachPassword, 'Set E2E_COACH_EMAIL and E2E_COACH_PASSWORD to run coach touch checks.')
  await login(page)
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/coach/calendar', { waitUntil: 'domcontentloaded', timeout: 60_000 })
  const calendar = page.getByLabel('Calendario mensile')
  await expect(calendar).toBeVisible({ timeout: 60_000 })

  const day = calendar.locator('button.cs-mobile-month-calendar__day').nth(10)
  await expect(day).toBeVisible()
  await day.scrollIntoViewIfNeeded()
  const box = await day.boundingBox()
  expect(box).toBeTruthy()
  await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await expect(day).toHaveAttribute('aria-pressed', 'true')
})
