import { defineConfig, devices } from '@playwright/test'
import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())

const adminAuthFile = 'test-results/.auth/admin.json'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      testMatch: /authorization\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      testMatch: /authorization\.spec\.ts/,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'admin-chromium',
      testMatch: /admin-account-model\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: adminAuthFile },
    },
    {
      name: 'admin-firefox',
      testMatch: /admin-account-model\.spec\.ts/,
      use: { ...devices['Desktop Firefox'], storageState: adminAuthFile },
    },
    {
      name: 'api-bola-chromium',
      testMatch: /api-bola\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  globalSetup: require.resolve('./tests/e2e/global-setup'),

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
})
