import { expect, test } from '@playwright/test'
import { e2eEnv } from './test-env'

const adminEmail = e2eEnv('E2E_ADMIN_EMAIL')
const adminPassword = e2eEnv('E2E_ADMIN_PASSWORD')

test.describe('admin authenticated smoke test', () => {
  test.describe.configure({ timeout: 120_000 })

  test.skip(
    !adminEmail || !adminPassword,
    'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run authenticated checks.'
  )

  test('loads the main admin pages for an admin account', async ({ page }) => {
    for (const [path, heading] of [
      ['/admin/users', 'Account e accessi'],
      ['/admin/messages', 'Messaggi'],
      ['/admin/calendar', 'Calendario'],
      ['/admin/membership-fees', 'Quote associative'],
      ['/admin/teams', 'Squadre'],
    ] as const) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 15_000 })
    }
  })

  test('loads seasonal athlete management and the single-create form', async ({ page }) => {
    await page.goto('/admin/atleti')
    await expect(page.getByRole('heading', { name: 'Atleti' })).toBeVisible({ timeout: 15_000 })

    const athletesResponse = await page.request.get('/api/admin/athletes')
    expect(athletesResponse.status()).toBe(200)
    const athletesPayload = await athletesResponse.json()
    expect(athletesPayload.athletes.length).toBeGreaterThan(0)
    expect(athletesPayload.athletes.every((athlete: { season_ids?: string[] }) => Array.isArray(athlete.season_ids))).toBe(true)

    await page.getByRole('button', { name: 'Nuovo Atleta' }).click()
    await expect(page.getByRole('heading', { name: 'Nuovo Atleta' })).toBeVisible()
    await expect(page.getByLabel('Stagione *', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Nome *', { exact: true })).toBeVisible()
    await expect(page.getByRole('group', { name: 'Squadre assegnate' })).toBeVisible()
  })

  test('previews an athlete CSV import in the selected season', async ({ page }) => {
    await page.goto('/admin/atleti')
    await expect(page.getByRole('heading', { name: 'Atleti' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Importa Atleti' }).click()
    await expect(page.getByRole('heading', { name: 'Importa Atleti' })).toBeVisible()

    await page.locator('#athlete-import-file').setInputFiles({
      name: 'atleti.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Nome,Cognome,Numero Tessera,Data Nascita\nMario,Rossi,TEST-IMPORT-001,2010-01-15\n'),
    })

    await expect(page.getByText('Valide: 1', { exact: true })).toBeVisible()
    await expect(page.getByText('TEST-IMPORT-001', { exact: true })).toBeVisible()

    const seasonId = await page.locator('#athlete-import-season').inputValue()
    const dryRunResponse = await page.request.post('/api/admin/athletes/import', {
      data: {
        season_id: seasonId,
        dry_run: true,
        rows: [{ first_name: 'Mario', last_name: 'Rossi', membership_number: 'TEST-IMPORT-API-001' }],
      },
    })
    expect(dryRunResponse.status()).toBe(200)
    const dryRun = await dryRunResponse.json()
    expect(dryRun.dryRun).toBe(true)
    expect(dryRun.created + dryRun.updated).toBe(1)
  })

  test('offers staff person payments without requiring a team', async ({ page }) => {
    await page.goto('/admin/payments')
    await expect(page.getByRole('heading', { name: 'Uscite' })).toBeVisible({ timeout: 15_000 })

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

  test('exposes CRUD actions for athletes and collaborators', async ({ page }) => {
    await page.goto('/admin/atleti')
    await expect(page.getByRole('heading', { name: 'Atleti' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Nuovo Atleta' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Importa Atleti' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Modifica' }).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Rimuovi' }).first()).toBeVisible({ timeout: 15_000 })

    await page.goto('/admin/collaboratori')
    await expect(page.getByRole('heading', { name: 'Collaboratori' })).toBeVisible({ timeout: 15_000 })
    const collaboratorsResponse = await page.request.get('/api/admin/collaborators')
    expect(collaboratorsResponse.status()).toBe(200)
    const collaboratorsPayload = await collaboratorsResponse.json()
    expect(Array.isArray(collaboratorsPayload.collaborators)).toBe(true)
    await expect(page.getByRole('button', { name: 'Nuovo Collaboratore' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Modifica' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Rimuovi' }).first()).toBeVisible()
  })
})
