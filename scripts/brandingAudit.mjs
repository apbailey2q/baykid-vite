#!/usr/bin/env node
// brandingAudit.mjs — Automated branding regression test.
//
// Fails (exit 1) if "BayKid" appears in any user-facing rendered string.
// Run via:  node scripts/brandingAudit.mjs
// Or:       npm run test:branding
//
// ── Rules ────────────────────────────────────────────────────────────────────
// ALLOWED (internal-only, intentionally kept):
//   - Code comments (// and block comments)
//   - localStorage key strings  ('baykid_*' / 'baykid-*')
//   - CustomEvent names          ('baykid_org_switch')
//   - Zustand persist name       ('baykid-auth')
//   - DB / Supabase table names  ('baykid_ai_posts', etc.)
//   - Constant identifier names  (BAYKID_ORG_ID)
//   - URL slug values            (slug: 'baykid')
//   - The branding.ts file itself (documents the rule)
//   - The brandingAudit.mjs file itself
//
// FORBIDDEN in user-facing positions:
//   - JSX text nodes (<span>BayKid</span>)
//   - String / template-literal values rendered to UI
//   - PWA manifest fields (name, short_name)
//   - Service-worker notification titles
//   - AI system-prompt text (shapes Claude-generated output users see)
//   - Placeholder / title / alt attributes
//   - Filenames of user-downloadable files

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname, basename } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')

// ── Files / dirs to scan ──────────────────────────────────────────────────────
const SCAN_DIRS  = ['src', 'api', 'public']
const SCAN_EXTS  = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.html', '.md'])

// ── Files that are whitelisted in their entirety (internal docs) ──────────────
const WHITELIST_FILES = new Set([
  'branding.ts',       // documents the rule itself — mentions BayKid by design
  'brandingAudit.mjs', // this file
  'CLAUDE.md',         // developer docs
])

// ── Line-level patterns that are always internal (never user-facing) ──────────
//    A line matching ANY of these is skipped entirely.
const INTERNAL_LINE_PATTERNS = [
  /^\s*\/\//,                          // single-line comment
  /^\s*\*/,                            // JSDoc / block-comment body
  /^\s*\/\*/,                          // block-comment open
  /baykid[_-][a-z]/i,                  // localStorage/event key  (baykid_ai_posts, baykid-auth)
  /BAYKID_ORG_ID/,                     // constant identifier
  /slug:\s*['"`]baykid['"`]/,          // URL slug value
  /name:\s*['"`]baykid-auth['"`]/,     // zustand persist name
  /baykid\.vercel\.app/,               // internal deployment URL (CORS allowlist)
  /supabaseAiTypes/,                   // DB type file (whole path)
  /'baykid[_-]/,                       // single-quoted storage key
  /"baykid[_-]/,                       // double-quoted storage key
  /`baykid[_-]/,                       // template-literal storage key
  /baykid_qa_run/,                     // QA run storage key
  /baykid_org_switch/,                 // CustomEvent name
  /baykid_notifs_generated_at/,        // internal flag
  /BAYKID/,                            // all-caps constant name
  /\.startsWith\(['"`]baykid/,         // key prefix check in auth cleanup
]

// ── Walk directory tree ───────────────────────────────────────────────────────
function walk(dir) {
  const entries = []
  try {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      const stat = statSync(full)
      if (stat.isDirectory()) {
        if (['node_modules', 'dist', '.git', '.claude'].includes(name)) continue
        entries.push(...walk(full))
      } else if (SCAN_EXTS.has(extname(name))) {
        entries.push(full)
      }
    }
  } catch { /* skip unreadable dirs */ }
  return entries
}

// ── Strip a line down to its non-comment content ─────────────────────────────
function stripInlineComment(line) {
  // Remove trailing  //  comments (crude but good enough for this check)
  const idx = line.indexOf('//')
  return idx >= 0 ? line.slice(0, idx) : line
}

// ── Main ──────────────────────────────────────────────────────────────────────
const BAYKID_RE = /baykid/i

let violations = []
let filesChecked = 0

for (const dir of SCAN_DIRS) {
  const abs = join(ROOT, dir)
  for (const filePath of walk(abs)) {
    const name = basename(filePath)
    if (WHITELIST_FILES.has(name)) continue

    filesChecked++
    const lines = readFileSync(filePath, 'utf8').split('\n')

    lines.forEach((rawLine, idx) => {
      if (!BAYKID_RE.test(rawLine)) return   // fast skip

      // Skip lines that are purely internal by pattern
      if (INTERNAL_LINE_PATTERNS.some(p => p.test(rawLine))) return

      // Strip trailing // comment then re-check
      const stripped = stripInlineComment(rawLine)
      if (!BAYKID_RE.test(stripped)) return

      violations.push({
        file: filePath.replace(ROOT + '\\', '').replace(ROOT + '/', ''),
        line: idx + 1,
        text: rawLine.trim(),
      })
    })
  }
}

// ── Report ────────────────────────────────────────────────────────────────────
const PASS = '\x1b[32m✓\x1b[0m'
const FAIL = '\x1b[31m✗\x1b[0m'
const BOLD = (s) => `\x1b[1m${s}\x1b[0m`
const DIM  = (s) => `\x1b[2m${s}\x1b[0m`

console.log('')
console.log(BOLD('Cyan\'s Brooklynn — Branding Audit'))
console.log('─'.repeat(52))
console.log(DIM(`Scanned ${filesChecked} files across: ${SCAN_DIRS.join(', ')}`))
console.log('')

if (violations.length === 0) {
  console.log(`${PASS} ${BOLD('PASS')} — No user-facing "BayKid" references found.\n`)
  process.exit(0)
} else {
  console.log(`${FAIL} ${BOLD('FAIL')} — Found ${violations.length} user-facing "BayKid" reference(s):\n`)
  for (const v of violations) {
    console.log(`  ${BOLD(v.file)}:${v.line}`)
    console.log(`    ${DIM(v.text)}\n`)
  }
  console.log('Fix: Replace BayKid with "Cyan\'s Brooklynn" in the above locations.')
  console.log('     Internal uses (localStorage keys, constants, comments) are allowed.\n')
  process.exit(1)
}
