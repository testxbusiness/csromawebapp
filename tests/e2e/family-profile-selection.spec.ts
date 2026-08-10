import { expect, test } from '@playwright/test'

test('preserves the selected athlete profile for a family account', async ({ page }) => {
  const email = process.env.E2E_GENITORE_EMAIL
  const password = process.env.E2E_GENITORE_PASSWORD

  test.skip(!email || !password, 'Family E2E credentials are not configured')

  await page.goto('/login')
  await page.getByLabel('Email').fill(email!)
  await page.getByLabel('Password').fill(password!)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await page.waitForURL(/\/dashboard/)

  const selector = page.locator('#accessible-profile-selector')
  await expect(selector).toBeVisible()
  await expect(selector.locator('option')).toHaveCount(3)
  await expect(selector.locator('option')).toContainText(['Giorgio Politi', 'Raffaella Scutieri'])

  const raffaellaOption = selector.locator('option', { hasText: 'Raffaella Scutieri' })
  const raffaellaId = await raffaellaOption.getAttribute('value')
  expect(raffaellaId).toBeTruthy()

  await selector.selectOption(raffaellaId!)
  await expect(selector).toHaveValue(raffaellaId!)
  await expect(page.getByRole('heading', { name: 'Bentornato, Raffaella Scutieri' })).toBeVisible()

  await page.goto('/athlete/calendar')
  await expect(page).toHaveURL(/\/athlete\/calendar/)
  await expect(selector).toHaveValue(raffaellaId!)

  await page.reload()
  await expect(selector).toHaveValue(raffaellaId!)
})
