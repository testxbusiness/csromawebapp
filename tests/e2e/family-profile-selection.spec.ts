import { expect, test, type Page } from '@playwright/test'
import { e2eEnv } from './test-env'

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await page.waitForURL(/\/dashboard/, { waitUntil: 'domcontentloaded', timeout: 60_000 })
}

test('allows a dual-role family account to select and preserve a linked athlete profile', async ({ page }) => {
  const email = e2eEnv('E2E_GENITORE_EMAIL')
  const password = e2eEnv('E2E_GENITORE_PASSWORD')

  test.skip(!email || !password, 'Family E2E credentials are not configured')

  await page.goto('/login')
  await page.getByLabel('Email').fill(email!)
  await page.getByLabel('Password').fill(password!)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await page.waitForURL(/\/dashboard/)

  // This account is also an athlete, so it initially opens its personal area.
  await page.getByRole('link', { name: 'Area familiare', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Area familiare', exact: true })).toBeVisible()

  const profileButtons = page.getByRole('button', { name: /^Apri profilo di / })
  // The account's own athlete profile is personal, not a family relation.
  await expect(profileButtons).toHaveCount(2)

  const selectedButtonLabel = await profileButtons.nth(0).getAttribute('aria-label')
  expect(selectedButtonLabel).toBeTruthy()
  await profileButtons.nth(0).click()

  await expect(page.getByRole('heading', { name: /^Oggi, / })).toBeVisible()
  await expect(page.locator('#athlete-events')).toBeVisible()
  const selectedProfileId = await page.evaluate(() => window.localStorage.getItem('csroma_active_subject_profile_id'))
  expect(selectedProfileId).toBeTruthy()

  await page.goto('/athlete/calendar')
  await expect(page).toHaveURL(/\/athlete\/calendar/)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Gestione Calendario', exact: true })).toBeVisible()
  await expect(page.locator('.fc-timegrid')).toBeVisible({ timeout: 30_000 })
  await expect(page.evaluate(() => window.localStorage.getItem('csroma_active_subject_profile_id'))).resolves.toBe(selectedProfileId)
})

test('keeps Agenda as the family mobile default and exposes the shared Mese view', async ({ page }) => {
  const email = e2eEnv('E2E_GENITORE_EMAIL')
  const password = e2eEnv('E2E_GENITORE_PASSWORD')
  test.skip(!email || !password, 'Family E2E credentials are not configured')

  await login(page, email!, password!)
  await page.getByRole('link', { name: 'Area familiare', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Area familiare', exact: true })).toBeVisible()
  const profileButtons = page.getByRole('button', { name: /^Apri profilo di / })
  await expect(profileButtons).toHaveCount(2)
  await profileButtons.nth(0).click()

  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/athlete/calendar', { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await expect(page.getByLabel('Agenda eventi')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'Agenda', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Mese', exact: true }).click()
  await expect(page.getByLabel('Calendario mensile')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})
