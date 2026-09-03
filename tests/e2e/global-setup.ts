import { chromium, type FullConfig } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { e2eEnv } from './test-env'

const authFile = path.resolve('test-results/.auth/admin.json')

export default async function globalSetup(config: FullConfig) {
  await mkdir(path.dirname(authFile), { recursive: true })

  const email = e2eEnv('E2E_ADMIN_EMAIL')
  const password = e2eEnv('E2E_ADMIN_PASSWORD')

  if (!email || !password) {
    await writeFile(authFile, JSON.stringify({ cookies: [], origins: [] }))
    return
  }

  const baseURL = config.projects[0].use.baseURL as string
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.goto(`${baseURL}/login`)
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)

    const loginResponsePromise = page.waitForResponse(
      (response) => response.url().endsWith('/api/auth/login'),
      { timeout: 120_000 },
    )
    await page.getByRole('button', { name: 'Accedi' }).click()
    const loginResponse = await loginResponsePromise

    if (loginResponse.status() !== 200) {
      throw new Error(`E2E admin login failed with HTTP ${loginResponse.status()}`)
    }

    // The local dev server compiles the authenticated shell and dashboard on
    // first navigation; allow that cold-start cost without weakening the
    // actual login status assertion above.
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 })
    await context.storageState({ path: authFile })
  } finally {
    await browser.close()
  }
}
