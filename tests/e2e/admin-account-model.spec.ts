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

  test('loads seasonal athlete management and the single-create form', async ({ page }) => {
    await page.goto('/admin/atleti')
    await expect(page.getByRole('heading', { name: 'Gestione Atleti' })).toBeVisible({ timeout: 15_000 })

    const athletesResponse = await page.request.get('/api/admin/athletes')
    expect(athletesResponse.status()).toBe(200)
    const athletesPayload = await athletesResponse.json()
    expect(athletesPayload.athletes.length).toBeGreaterThan(0)
    expect(athletesPayload.athletes.every((athlete: { season_ids?: string[] }) => Array.isArray(athlete.season_ids))).toBe(true)

    await page.getByRole('button', { name: 'Nuovo Atleta' }).click()
    await expect(page.getByRole('heading', { name: 'Nuovo Atleta' })).toBeVisible()
    await expect(page.getByLabel('Stagione *', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Nome *', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Attività', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Squadra', { exact: true })).toBeVisible()
  })

  test('offers staff person payments without requiring a team', async ({ page }) => {
    await page.goto('/admin/payments')
    await expect(page.getByRole('heading', { name: 'Pagamenti' })).toBeVisible({ timeout: 15_000 })

    const payeesResponse = await page.request.get('/api/admin/payment-payees')
    expect(payeesResponse.status()).toBe(200)
    const payeesPayload = await payeesResponse.json()
    expect(Array.isArray(payeesPayload.payees)).toBe(true)

    await page.getByRole('button', { name: 'Nuovo Pagamento' }).click()
    await expect(page.getByRole('heading', { name: 'Nuovo Pagamento' })).toBeVisible()

    const typeSelect = page.locator('select').filter({ has: page.locator('option[value="person_payment"]') }).last()
    await typeSelect.selectOption('person_payment')
    await expect(page.getByText('Persona destinataria *', { exact: true })).toBeVisible()
    await expect(page.getByText('Palestra, attività e squadra restano opzionali per questo pagamento.', { exact: true })).toBeVisible()
  })
})
