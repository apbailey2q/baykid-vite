// api/_lib/driver/encryptW9.ts — W9 TIN (SSN/EIN) at-rest crypto.
//
// Thin wrapper around api/_lib/encrypt.ts so the encryption key and packed
// format used by social_accounts.access_token_encrypted are shared with
// driver_profiles.w9_tin_encrypted. Server-only: never imported by browser
// code. Used by a future admin tool that reads the TIN for tax filing —
// browser surfaces only render w9_legal_name + w9_address.
//
// Stored as bytea. Round-trip via decodeBytea() if reading from Supabase JS.

import { encryptToken, decryptToken } from '../encrypt.js'

/** Encrypt a 9-digit TIN (SSN/EIN). Caller is responsible for stripping any
 *  formatting characters before calling. */
export function encryptW9Tin(tin: string): Buffer {
  if (!tin) throw new Error('encryptW9Tin: empty TIN')
  return encryptToken(tin)
}

/** Decrypt the packed bytea TIN. */
export function decryptW9Tin(packed: Buffer): string {
  return decryptToken(packed)
}
