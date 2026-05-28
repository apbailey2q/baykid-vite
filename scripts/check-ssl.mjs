// scripts/check-ssl.mjs
// Verifies the TLS cert on TARGET_URL is valid and not expiring within
// WARN_DAYS (default 14). Designed to run from CI; exits 1 on failure so
// the workflow turns red. No external deps.

import tls from 'node:tls'
import { URL } from 'node:url'

const target = process.env.TARGET_URL
if (!target) {
  console.error('TARGET_URL not set')
  process.exit(2)
}

const warnDays = Number.parseInt(process.env.WARN_DAYS ?? '14', 10)

const url      = new URL(target)
const hostname = url.hostname
const port     = url.port ? Number.parseInt(url.port, 10) : 443

const socket = tls.connect({
  host: hostname,
  port,
  servername: hostname,
  rejectUnauthorized: true,
  timeout: 10_000,
}, () => {
  const cert = socket.getPeerCertificate(true)
  if (!cert || !cert.valid_to) {
    console.error(`❌ No cert returned for ${hostname}`)
    socket.end()
    process.exit(1)
  }

  const expiresAt = new Date(cert.valid_to)
  const now       = new Date()
  const daysLeft  = Math.floor((expiresAt - now) / (1000 * 60 * 60 * 24))

  console.log(`Host:    ${hostname}`)
  console.log(`Subject: ${cert.subject?.CN ?? '(unknown)'}`)
  console.log(`Issuer:  ${cert.issuer?.O ?? cert.issuer?.CN ?? '(unknown)'}`)
  console.log(`Valid:   ${cert.valid_from} → ${cert.valid_to}`)
  console.log(`Days left: ${daysLeft}`)

  socket.end()

  if (daysLeft < 0) {
    console.error(`❌ Certificate for ${hostname} EXPIRED ${-daysLeft} day(s) ago`)
    process.exit(1)
  }
  if (daysLeft < warnDays) {
    console.error(`⚠️ Certificate for ${hostname} expires in ${daysLeft} day(s) (< ${warnDays})`)
    process.exit(1)
  }
  console.log(`✅ Cert healthy (${daysLeft} day(s) remaining)`)
})

socket.on('error', (err) => {
  console.error(`❌ TLS error for ${hostname}: ${err.message}`)
  process.exit(1)
})
socket.on('timeout', () => {
  console.error(`❌ TLS handshake timed out for ${hostname}`)
  socket.destroy()
  process.exit(1)
})
