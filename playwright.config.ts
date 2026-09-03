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
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
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
      use: { ...devices['Desktop Chrome'], storageState: adminAuthFile, navigationTimeout: 120_000 },
    },
    {
      name: 'admin-firefox',
      testMatch: /admin-account-model\.spec\.ts/,
      use: { ...devices['Desktop Firefox'], storageState: adminAuthFile },
    },
    {
      name: 'admin-responsive-chromium',
      testMatch: /admin-responsive\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: adminAuthFile, navigationTimeout: 120_000 },
    },
    {
      name: 'api-bola-chromium',
      testMatch: /api-bola\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'family-chromium',
      testMatch: /family-profile-selection\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'athlete-chromium',
      testMatch: /athlete-dashboard\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'athlete-championships-chromium',
      testMatch: /athlete-championships\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'athlete-calendar-chromium',
      testMatch: /athlete-calendar\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'athlete-messages-chromium',
      testMatch: /athlete-messages\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'athlete-fees-profile-chromium',
      testMatch: /athlete-fees-profile\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'pwa-chromium',
      testMatch: /pwa\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  globalSetup: require.resolve('./tests/e2e/global-setup'),

  ...(process.env.E2E_BASE_URL
    ? {}
    : {
        webServer: {
          command: 'npm run dev',
          url: 'http://localhost:3000',
          reuseExistingServer: !process.env.CI,
          timeout: 120 * 1000,
        },
      }),
})
