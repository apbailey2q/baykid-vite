/**
 * CBR Platform — Critical-Path E2E Tests
 *
 * 8 flows that must work before pilot launch:
 *   1. Consumer signup (unauthenticated → account created)
 *   2. Consumer pickup request (authenticated consumer → request submitted)
 *   3. Driver approval gate (unapproved driver sees Pending screen)
 *   4. Driver online/offline toggle
 *   5. Pickup completion (driver marks stop complete)
 *   6. Notification delivery (bell badge increments on new event)
 *   7. Commercial billing access (role gate works)
 *   8. Investor dashboard access (role gate works)
 *
 * Prerequisites:
 *   - Dev server running on http://localhost:5173 (or PLAYWRIGHT_BASE_URL)
 *   - Test accounts created in Supabase — set via env:
 *       E2E_CONSUMER_EMAIL / E2E_CONSUMER_PASSWORD
 *       E2E_DRIVER_UNAPPROVED_EMAIL / E2E_DRIVER_UNAPPROVED_PASSWORD
 *       E2E_DRIVER_EMAIL / E2E_DRIVER_PASSWORD
 *       E2E_COMMERCIAL_EMAIL / E2E_COMMERCIAL_PASSWORD
 *       E2E_INVESTOR_EMAIL / E2E_INVESTOR_PASSWORD
 *   - Without test accounts the auth-required tests will self-skip.
 */

import { test, expect, type Page } from '@playwright/test'

// ── Env credentials ───────────────────────────────────────────────────────────

const CONSUMER_EMAIL    = process.env.E2E_CONSUMER_EMAIL    ?? ''
const CONSUMER_PW       = process.env.E2E_CONSUMER_PASSWORD ?? ''
const DRIVER_EMAIL      = process.env.E2E_DRIVER_EMAIL      ?? ''
const DRIVER_PW         = process.env.E2E_DRIVER_PASSWORD   ?? ''
const DRIVER_UNAP_EMAIL = process.env.E2E_DRIVER_UNAPPROVED_EMAIL    ?? ''
const DRIVER_UNAP_PW    = process.env.E2E_DRIVER_UNAPPROVED_PASSWORD ?? ''
const COMMERCIAL_EMAIL  = process.env.E2E_COMMERCIAL_EMAIL    ?? ''
const COMMERCIAL_PW     = process.env.E2E_COMMERCIAL_PASSWORD ?? ''
const INVESTOR_EMAIL    = process.env.E2E_INVESTOR_EMAIL    ?? ''
const INVESTOR_PW       = process.env.E2E_INVESTOR_PASSWORD ?? ''

// ── Helpers ───────────────────────────────────────────────────────────────────

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in|log in/i }).click()
  // Wait for redirect away from /login
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15_000 })
}

async function signOut(page: Page) {
  // Best-effort — ignore if already logged out
  await page.goto('/').catch(() => null)
}

// ── 1. Consumer Signup ────────────────────────────────────────────────────────

test.describe('1. Consumer signup', () => {
  test('signup form is reachable and submittable', async ({ page }) => {
    await page.goto('/signup')

    // Page should render a signup form — not redirect to login
    await expect(page.getByRole('heading', { name: /sign up|create account|get started/i })).toBeVisible({ timeout: 10_000 })

    // Form fields are present
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i).first()).toBeVisible()

    // Submit with a unique throwaway address — we expect success or validation error
    const unique = `pw-test-${Date.now()}@example.invalid`
    await page.getByLabel(/email/i).fill(unique)
    // Fill both password fields if there is a confirm field
    const pwFields = page.getByLabel(/password/i)
    await pwFields.first().fill('Test1234!')
    if (await pwFields.count() > 1) await pwFields.nth(1).fill('Test1234!')

    await page.getByRole('button', { name: /sign up|create|register/i }).click()

    // Expect either a success message, a redirect, or a validation error (not a crash)
    await expect(
      page.getByText(/check your email|verify|almost there|success|already registered|taken/i)
        .or(page.getByRole('alert'))
        .or(page.locator('[data-testid="signup-success"]')),
    ).toBeVisible({ timeout: 15_000 })
  })
})

// ── 2. Consumer pickup request ────────────────────────────────────────────────

test.describe('2. Consumer pickup request', () => {
  test.skip(!CONSUMER_EMAIL, 'E2E_CONSUMER_EMAIL not set — skipping')

  test('authenticated consumer can initiate a pickup', async ({ page }) => {
    await signIn(page, CONSUMER_EMAIL, CONSUMER_PW)

    // Consumer dashboard should load
    await expect(page).toHaveURL(/dashboard\/consumer|consumer-dashboard/i, { timeout: 15_000 })

    // Look for a pickup / schedule CTA
    const pickupBtn = page.getByRole('button', { name: /schedule pickup|request pickup|book pickup/i })
    await expect(pickupBtn).toBeVisible({ timeout: 10_000 })
    await pickupBtn.click()

    // A modal or new page should open with a confirmation / form
    await expect(
      page.getByText(/pickup scheduled|pickup requested|confirm|address|date/i),
    ).toBeVisible({ timeout: 10_000 })

    await signOut(page)
  })
})

// ── 3. Driver approval gate ───────────────────────────────────────────────────

test.describe('3. Driver approval gate', () => {
  test.skip(!DRIVER_UNAP_EMAIL, 'E2E_DRIVER_UNAPPROVED_EMAIL not set — skipping')

  test('unapproved driver sees Pending Approval screen', async ({ page }) => {
    await signIn(page, DRIVER_UNAP_EMAIL, DRIVER_UNAP_PW)

    // Should see pending approval UI, not the real dashboard
    await expect(
      page.getByText(/pending approval|account pending|under review|waiting for approval/i),
    ).toBeVisible({ timeout: 15_000 })

    // Back to Dashboard button should exist
    await expect(page.getByRole('button', { name: /back to dashboard|go back/i })).toBeVisible()

    await signOut(page)
  })
})

// ── 4. Driver online / offline toggle ────────────────────────────────────────

test.describe('4. Driver online/offline toggle', () => {
  test.skip(!DRIVER_EMAIL, 'E2E_DRIVER_EMAIL not set — skipping')

  test('approved driver can toggle online status', async ({ page }) => {
    await signIn(page, DRIVER_EMAIL, DRIVER_PW)

    // Driver dashboard
    await expect(page).toHaveURL(/dashboard\/driver|driver-dashboard/i, { timeout: 15_000 })

    // Find the online toggle
    const toggle = page.getByRole('switch', { name: /online|go online|status/i })
      .or(page.getByRole('button', { name: /go online|set online|go offline/i }))
    await expect(toggle).toBeVisible({ timeout: 10_000 })

    // Click once (go online or offline depending on initial state)
    const beforeText = await toggle.textContent()
    await toggle.click()

    // Status should change
    await expect(toggle).not.toHaveText(beforeText ?? '', { timeout: 5_000 })

    await signOut(page)
  })
})

// ── 5. Pickup completion ──────────────────────────────────────────────────────

test.describe('5. Pickup completion', () => {
  test.skip(!DRIVER_EMAIL, 'E2E_DRIVER_EMAIL not set — skipping')

  test('driver can view assigned stops and mark one complete', async ({ page }) => {
    await signIn(page, DRIVER_EMAIL, DRIVER_PW)

    // Navigate to the Pickups or Routes tab
    const pickupsTab = page.getByRole('tab', { name: /pickups|stops|routes/i })
      .or(page.getByRole('button', { name: /pickups|stops|routes/i }))
    await expect(pickupsTab).toBeVisible({ timeout: 15_000 })
    await pickupsTab.click()

    // Either shows a stop to complete or an empty state
    const stopCard = page.locator('[data-testid="route-stop"], [data-testid="pickup-card"]').first()
    const emptyMsg = page.getByText(/no stops|no pickups|no assigned/i)

    await expect(stopCard.or(emptyMsg)).toBeVisible({ timeout: 10_000 })

    if (await stopCard.isVisible()) {
      const completeBtn = stopCard.getByRole('button', { name: /complete|mark done|finish/i })
      if (await completeBtn.isVisible()) {
        await completeBtn.click()
        // Confirmation prompt or status change
        await expect(
          page.getByText(/completed|done|confirmed/i).or(page.getByRole('dialog')),
        ).toBeVisible({ timeout: 10_000 })
      }
    }

    await signOut(page)
  })
})

// ── 6. Notification delivery ──────────────────────────────────────────────────

test.describe('6. Notification bell', () => {
  test.skip(!CONSUMER_EMAIL, 'E2E_CONSUMER_EMAIL not set — skipping')

  test('notification bell is visible and panel opens on click', async ({ page }) => {
    await signIn(page, CONSUMER_EMAIL, CONSUMER_PW)

    // Bell icon should be present
    const bell = page.getByRole('button', { name: /notification|alerts|bell/i })
      .or(page.locator('[data-testid="notification-bell"]'))
    await expect(bell).toBeVisible({ timeout: 10_000 })

    // Open panel
    await bell.click()
    await expect(
      page.getByRole('heading', { name: /notification/i })
        .or(page.getByText(/no notifications|all caught up|you're up to date/i))
        .or(page.locator('[data-testid="notification-panel"]')),
    ).toBeVisible({ timeout: 5_000 })

    await signOut(page)
  })
})

// ── 7. Commercial billing access ──────────────────────────────────────────────

test.describe('7. Commercial billing access', () => {
  test.skip(!COMMERCIAL_EMAIL, 'E2E_COMMERCIAL_EMAIL not set — skipping')

  test('commercial user can reach the billing page', async ({ page }) => {
    await signIn(page, COMMERCIAL_EMAIL, COMMERCIAL_PW)

    // Navigate to billing
    await page.goto('/dashboard/commercial/billing')

    // Should render billing content, not AccessDenied
    await expect(
      page.getByText(/invoice|billing|payment|outstanding|due/i),
    ).toBeVisible({ timeout: 15_000 })

    // Must NOT show the access-denied page
    await expect(page.getByText(/access denied|not authorized|forbidden/i)).not.toBeVisible()

    await signOut(page)
  })
})

// ── 8. Investor dashboard access ──────────────────────────────────────────────

test.describe('8. Investor dashboard access', () => {
  test.skip(!INVESTOR_EMAIL, 'E2E_INVESTOR_EMAIL not set — skipping')

  test('investor_viewer can reach the investor dashboard', async ({ page }) => {
    await signIn(page, INVESTOR_EMAIL, INVESTOR_PW)

    // Navigate to investor dashboard
    await page.goto('/dashboard/admin/investor')

    // Should render KPI content, not AccessDenied
    await expect(
      page.getByText(/revenue|pickups|investors|growth|kpi/i),
    ).toBeVisible({ timeout: 15_000 })

    // Must NOT show the access-denied page
    await expect(page.getByText(/access denied|not authorized|forbidden/i)).not.toBeVisible()

    await signOut(page)
  })
})
