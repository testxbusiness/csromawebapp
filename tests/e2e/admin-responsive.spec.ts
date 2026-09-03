import { expect, test } from '@playwright/test'
import { e2eEnv } from './test-env'

const adminEmail = e2eEnv('E2E_ADMIN_EMAIL')
const adminPassword = e2eEnv('E2E_ADMIN_PASSWORD')

test.describe('admin responsive and operational gate', () => {
  test.describe.configure({ timeout: 180_000 })
  test.skip(!adminEmail || !adminPassword, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run admin responsive checks.')

  test('keeps the admin route map reachable', async ({ page }) => {
    const routes = [
      '/admin/activities',
      '/admin/atleti',
      '/admin/balance',
      '/admin/calendar',
      '/admin/campionati',
      '/admin/collaboratori',
      '/admin/documents',
      '/admin/gyms',
      '/admin/incassi',
      '/admin/membership-fees',
      '/admin/messages',
      '/admin/payments',
      '/admin/profile',
      '/admin/profiles',
      '/admin/seasons',
      '/admin/teams',
      '/admin/users',
      '/dashboard',
    ]

    for (const route of routes) {
      const response = await page.goto(route, { waitUntil: 'commit', timeout: 60_000 })
      expect(response?.status(), `${route} should respond successfully`).toBeLessThan(400)
      await expect(page.locator('main')).toBeVisible()
      await expect(page).toHaveURL(new RegExp(`${route.replaceAll('/', '\\/')}$`))
    }
  })

  test('keeps sidebar, focus and layout usable at admin viewports', async ({ page }) => {
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 375, height: 812 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport)
      await page.goto('/admin/users', { waitUntil: 'domcontentloaded', timeout: 60_000 })
      await expect(page.getByRole('heading', { name: 'Account e accessi' })).toBeVisible({ timeout: 30_000 })

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
      expect(overflow, `no horizontal overflow at ${viewport.width}x${viewport.height}`).toBe(false)

      const sidebar = page.locator('aside.cs-sidebar--admin')
      if (viewport.width <= 768) {
        await expect(sidebar).toBeHidden()
        await page.getByRole('button', { name: 'Apri navigazione' }).click()
        await expect(page.getByRole('navigation', { name: 'Navigazione amministrazione' })).toBeVisible()
        await page.getByRole('button', { name: 'Chiudi menu' }).press('Escape')
      } else {
        await expect(sidebar).toBeVisible()
      }

      const activeLink = page.getByRole('link', { name: 'Account e accessi' })
      await activeLink.focus()
      await expect(activeLink).toHaveAttribute('aria-current', 'page')
      expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-current'))).toBe('page')
    }
  })

  test('exposes table, filters and modal interactions without side effects', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.route('**/api/admin/payments', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{
            id: 'e2e-payment-1',
            type: 'general_cost',
            description: 'Fixture palestra',
            amount: 1250,
            frequency: 'one_time',
            status: 'pending',
            due_date: '2026-09-15',
            gyms: { id: 'gym-1', name: 'Palestra Test', address: 'Roma' },
          }]),
        })
        return
      }
      await route.continue()
    })
    await page.route('**/api/admin/payment-payees', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ payees: [] }) })
    })
    await page.goto('/admin/payments', { waitUntil: 'commit', timeout: 60_000 })
    await expect(page.getByRole('heading', { name: 'Uscite' })).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('table.cs-table').first()).toBeVisible({ timeout: 60_000 })
    await expect(page.locator('select').nth(0)).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('select').nth(1)).toBeVisible({ timeout: 30_000 })

    await page.getByRole('button', { name: 'Nuovo Pagamento' }).click()
    await expect(page.getByRole('heading', { name: 'Nuovo Pagamento' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Nuovo Pagamento' })).toBeHidden()
  })

  test('completes the integrated bulk payment flow', async ({ page }) => {
    let paymentRequestBody: { installmentIds: string[]; paymentDate: string; paymentMethod: string } | null = null

    await page.route('**/api/admin/incassi/kpi', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { not_due: 0, due_soon: 1, overdue: 0, partially_paid: 0, paid: 0, total_amount: 100, total_paid: 0 } }),
      })
    })
    await page.route('**/api/admin/incassi/installments**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          installments: [{
            id: 'e2e-installment-1',
            membership_fee_id: 'e2e-fee-1',
            profile_id: 'e2e-profile-1',
            installment_number: 1,
            due_date: '2026-09-15',
            amount: 100,
            status: 'due_soon',
            profile: { id: 'e2e-profile-1', first_name: 'Atleta', last_name: 'Test', email: 'atleta@example.com' },
            membership_fee: { id: 'e2e-fee-1', name: 'Quota test', team_id: 'e2e-team-1' },
            team: { id: 'e2e-team-1', name: 'U16 Test', code: 'U16' },
          }],
          total: 1,
        }),
      })
    })
    await page.route('**/api/admin/incassi/payments', async (route) => {
      if (route.request().method() === 'POST') {
        paymentRequestBody = route.request().postDataJSON() as typeof paymentRequestBody
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Pagamento registrato' }) })
        return
      }
      await route.continue()
    })

    await page.goto('/admin/incassi', { waitUntil: 'commit', timeout: 60_000 })
    await expect(page.getByRole('heading', { name: 'Incassi' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Atleta Test').first()).toBeVisible({ timeout: 30_000 })

    const rowCheckbox = page.locator('table input[type="checkbox"]').nth(1)
    await rowCheckbox.check()
    await page.getByRole('button', { name: /Segna come pagate \(1\)/ }).click()
    await expect(page.getByRole('heading', { name: /Segna come pagate \(1 rate\)/ })).toBeVisible()
    await page.getByRole('button', { name: /Conferma \(1 rate\)/ }).click()

    await expect.poll(() => paymentRequestBody).toEqual({
      installmentIds: ['e2e-installment-1'],
      paymentDate: expect.any(String),
      paymentMethod: 'cash',
    })
    await expect(page.getByRole('heading', { name: /Segna come pagate/ })).toBeHidden()
  })
})
