import { expect, test } from '@playwright/test'
import { e2eEnv } from './test-env'

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

  const profileButtons = page.getByRole('button', { name: /^Visualizza area atleta di / })
  // The account's own athlete profile is personal, not a family relation.
  await expect(profileButtons).toHaveCount(2)

  const selectedButtonLabel = await profileButtons.nth(0).getAttribute('aria-label')
  expect(selectedButtonLabel).toBeTruthy()
  await profileButtons.nth(0).click()

  await expect(page.getByRole('heading', { name: /^Bentornato, / })).toBeVisible()
  await expect(page.locator('#athlete-events')).toBeVisible()
  const selectedProfileId = await page.evaluate(() => window.localStorage.getItem('csroma_active_subject_profile_id'))
  expect(selectedProfileId).toBeTruthy()

  await page.goto('/athlete/calendar')
  await expect(page).toHaveURL(/\/athlete\/calendar/)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Gestione Calendario', exact: true })).toBeVisible()
  await expect(page.evaluate(() => window.localStorage.getItem('csroma_active_subject_profile_id'))).resolves.toBe(selectedProfileId)
})
