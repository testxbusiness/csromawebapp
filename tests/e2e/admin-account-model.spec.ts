import { expect, test } from '@playwright/test'

const adminEmail = process.env.E2E_ADMIN_EMAIL
const adminPassword = process.env.E2E_ADMIN_PASSWORD

test.describe('admin authenticated smoke test', () => {
  test.skip(
    !adminEmail || !adminPassword,
    'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run authenticated checks.'
  )

  test('loads the main admin pages for an admin account', async ({ page }) => {
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
