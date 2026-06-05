import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E configuration — CBR platform critical-path tests.
 *
 * Run:
 *   npx playwright test              # headless
 *   npx playwright test --ui         # Playwright UI mode
 *   npx playwright test --headed     # headed (watch the browser)
 *   npx playwright show-report       # HTML report after run
 *
 * Requires the dev server to be running on http://localhost:5173.
 * Set PLAYWRIGHT_BASE_URL to override (e.g. staging URL).
 */

export default defineConfig({
  testDir: './e2e',

  // Fail fast on first test failure in CI; all tests locally
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries:    process.env.CI ? 2 : 0,
  workers:    process.env.CI ? 1 : undefined,

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],

  use: {
    baseURL:       process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
    trace:         'on-first-retry',
    screenshot:    'only-on-failure',
    video:         'on-first-retry',
    // Viewport matches mobile-first design
    viewport:      { width: 390, height: 844 },
  },

  projects: [
    // Mobile Chrome — primary target (app is mobile-first)
    {
      name:  'chromium-mobile',
      use:   { ...devices['Pixel 5'] },
    },
    // Desktop Chrome — secondary (admin / commercial dashboards)
    {
      name:  'chromium-desktop',
      use:   { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],

  // Automatically start the dev server if not already running
  webServer: {
    command:            'npm run dev',
    url:                'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout:            60_000,
  },
})
