import { expect, test } from '@playwright/test'

const adminEmail = process.env.E2E_ADMIN_EMAIL
const adminPassword = process.env.E2E_ADMIN_PASSWORD

test.describe('account-based authorization', () => {
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
})

test.describe('admin authenticated smoke test', () => {
  test.skip(
    !adminEmail || !adminPassword,
    'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run authenticated checks.'
  )

  test('loads the main admin pages for an admin account', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(adminEmail as string)
    await page.getByLabel('Password').fill(adminPassword as string)

    const loginResponsePromise = page.waitForResponse((response) =>
      response.url().endsWith('/api/auth/login')
    )
    await page.getByRole('button', { name: 'Accedi' }).click()
    const loginResponse = await loginResponsePromise
    expect(loginResponse.status(), 'E2E login request failed').toBe(200)

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })

    for (const [path, heading] of [
      ['/admin/users', 'Gestione Utenti'],
      ['/admin/messages', 'Gestione Messaggi'],
      ['/admin/calendar', 'Gestione Calendario'],
      ['/admin/membership-fees', 'Gestione Quote Associative'],
      ['/admin/teams', 'Gestione Squadre'],
    ] as const) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 15_000 })
    }
  })
})
