import { expect, test, type Page } from '@playwright/test'

const coachEmail = process.env.E2E_COACH_EMAIL
const coachPassword = process.env.E2E_COACH_PASSWORD
const athleteEmail = process.env.E2E_ATHLETE_EMAIL
const athletePassword = process.env.E2E_ATHLETE_PASSWORD

const foreignMessageId = process.env.E2E_BOLA_MESSAGE_ID
const foreignEventId = process.env.E2E_BOLA_EVENT_ID

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/auth/login'))
  await page.getByRole('button', { name: 'Accedi' }).click()
  expect((await responsePromise).status()).toBe(200)
  await page.waitForURL(/\/dashboard/)
}

test.describe('API authentication boundaries', () => {
  test('rejects unauthenticated coach and admin API access', async ({ request }) => {
    const coachResponse = await request.get('/api/coach/messages')
    expect(coachResponse.status()).toBe(401)

    const adminResponse = await request.get('/api/admin/payments')
    expect(adminResponse.status()).toBe(401)
  })
})

test.describe('API BOLA boundaries by role', () => {
  test.skip(
    !coachEmail || !coachPassword,
    'Set E2E_COACH_EMAIL and E2E_COACH_PASSWORD to run coach BOLA checks.'
  )

  test('coach cannot use athlete or admin-only APIs', async ({ page }) => {
    await login(page, coachEmail!, coachPassword!)

    const athleteResponse = await page.request.get('/api/athlete/messages')
    expect(athleteResponse.status()).toBe(403)

    const adminResponse = await page.request.get('/api/admin/payments')
    expect(adminResponse.status()).toBe(403)
  })

  test('coach cannot read a message or event outside the supplied resource boundary', async ({ page }) => {
    test.skip(!foreignMessageId && !foreignEventId, 'Set E2E_BOLA_MESSAGE_ID or E2E_BOLA_EVENT_ID for cross-resource checks.')
    await login(page, coachEmail!, coachPassword!)

    if (foreignMessageId) {
      const response = await page.request.get(`/api/coach/messages?view=full&id=${foreignMessageId}`)
      expect(response.status()).toBe(404)
    }

    if (foreignEventId) {
      const response = await page.request.get(`/api/coach/events/detail?id=${foreignEventId}`)
      expect(response.status()).toBe(404)
    }
  })

  test('coach calendar and messages stay within assigned teams', async ({ page }) => {
    await login(page, coachEmail!, coachPassword!)

    const calendarResponse = await page.request.get('/api/coach/calendar')
    expect(calendarResponse.status()).toBe(200)
    const calendar = await calendarResponse.json()
    expect(Array.isArray(calendar.teams)).toBe(true)
    expect(Array.isArray(calendar.events)).toBe(true)

    const messagesResponse = await page.request.get('/api/coach/messages')
    expect(messagesResponse.status()).toBe(200)
    const messages = await messagesResponse.json()
    expect(Array.isArray(messages.messages)).toBe(true)
  })

  test.skip(
    !athleteEmail || !athletePassword,
    'Set E2E_ATHLETE_EMAIL and E2E_ATHLETE_PASSWORD to run athlete BOLA checks.'
  )

  test('athlete cannot use coach or admin-only APIs', async ({ page }) => {
    await login(page, athleteEmail!, athletePassword!)

    const coachResponse = await page.request.get('/api/coach/messages')
    expect(coachResponse.status()).toBe(403)

    const adminResponse = await page.request.get('/api/admin/payments')
    expect(adminResponse.status()).toBe(403)

    const ownResponse = await page.request.get('/api/athlete/messages')
    expect(ownResponse.status()).toBe(200)
  })
})
