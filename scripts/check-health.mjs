// scripts/check-health.mjs
// Hits TARGET_URL/api/health, verifies HTTP 200 + JSON payload + environment
// label matches EXPECTED_ENV. Designed to run from CI; exits 1 on failure.

import { setTimeout as wait } from 'node:timers/promises'

const target      = process.env.TARGET_URL
const expectedEnv = process.env.EXPECTED_ENV
if (!target) { console.error('TARGET_URL not set'); process.exit(2) }

const url = new URL('/api/health', target).toString()

const MAX_RETRIES = 3
const TIMEOUT_MS  = 10_000

for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)

    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    clearTimeout(timer)

    if (!res.ok) {
      console.error(`Attempt ${attempt}: HTTP ${res.status}`)
      if (attempt < MAX_RETRIES) { await wait(2000); continue }
      process.exit(1)
    }

    let json
    try { json = await res.json() }
    catch { console.error('Response was not valid JSON'); process.exit(1) }

    console.log(JSON.stringify(json, null, 2))

    if (json.status !== 'ok') {
      console.error(`Health payload reported status="${json.status}"`)
      process.exit(1)
    }
    if (expectedEnv && json.environment && json.environment !== expectedEnv) {
      console.error(`Environment mismatch: expected="${expectedEnv}" got="${json.environment}"`)
      process.exit(1)
    }

    console.log(`✅ ${url} healthy (${json.environment ?? 'unknown env'}, v${json.version ?? '?'})`)
    process.exit(0)
  } catch (err) {
    console.error(`Attempt ${attempt}: ${err?.message ?? err}`)
    if (attempt < MAX_RETRIES) await wait(2000)
    else process.exit(1)
  }
}
