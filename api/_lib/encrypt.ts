// api/_lib/encrypt.ts — AES-256-GCM token encryption for at-rest storage.
//
// Key: OAUTH_TOKEN_ENCRYPTION_KEY env var, 32 raw bytes encoded as base64.
// Generate with:    openssl rand -base64 32
// Set in Vercel:    Project Settings → Environment Variables → server-only.
//
// Output format (packed Buffer): [12-byte IV][16-byte authTag][ciphertext...]
// Stored in Postgres bytea columns (social_accounts.access_token_encrypted etc).
//
// IMPORTANT: rotating the key invalidates every previously-stored token. If
// rotation is needed, build a re-encrypt migration that decrypts with the old
// key and re-encrypts with the new one before swapping the env var.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGO       = 'aes-256-gcm'
const IV_BYTES   = 12
const TAG_BYTES  = 16
const KEY_BYTES  = 32

let cachedKey: Buffer | null = null

function loadKey(): Buffer {
  if (cachedKey) return cachedKey
  const raw = process.env.OAUTH_TOKEN_ENCRYPTION_KEY
  if (!raw) {
    throw new Error('OAUTH_TOKEN_ENCRYPTION_KEY not set — generate with `openssl rand -base64 32` and add to Vercel env')
  }
  const buf = Buffer.from(raw, 'base64')
  if (buf.length !== KEY_BYTES) {
    throw new Error(`OAUTH_TOKEN_ENCRYPTION_KEY must be ${KEY_BYTES} bytes (base64-decoded), got ${buf.length}`)
  }
  cachedKey = buf
  return buf
}

export function encryptToken(plaintext: string): Buffer {
  if (!plaintext) throw new Error('encryptToken: empty input')
  const key    = loadKey()
  const iv     = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, key, iv)
  const ct     = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag    = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ct])
}

export function decryptToken(packed: Buffer): string {
  if (packed.length < IV_BYTES + TAG_BYTES + 1) {
    throw new Error('decryptToken: ciphertext too short')
  }
  const key      = loadKey()
  const iv       = packed.subarray(0, IV_BYTES)
  const tag      = packed.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const ct       = packed.subarray(IV_BYTES + TAG_BYTES)
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}

// Convenience for round-tripping through Supabase JS, which returns bytea as
// a hex string prefixed with '\\x'.
export function decodeBytea(value: string | Buffer | Uint8Array): Buffer {
  if (Buffer.isBuffer(value)) return value
  if (value instanceof Uint8Array) return Buffer.from(value)
  if (typeof value === 'string') {
    if (value.startsWith('\\x')) return Buffer.from(value.slice(2), 'hex')
    return Buffer.from(value, 'base64')
  }
  throw new Error('decodeBytea: unsupported value type')
}
