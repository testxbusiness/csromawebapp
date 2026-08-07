import { expect, test } from '@playwright/test'

test('redirects unauthenticated users away from the dashboard', async ({ page }) => {
  await page.goto('/dashboard')

  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: 'CSRoma WebApp' })).toBeVisible()
})

test('redirects unauthenticated users away from admin pages', async ({ page }) => {
  await page.goto('/admin/users')

  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('button', { name: 'Accedi' })).toBeVisible()
})
