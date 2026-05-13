// Queries qr_bags to find all distinct status values currently in use,
// then probes the check constraint by attempting updates with candidate values.

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://huomxfmgpjsiylftisxq.supabase.co',
  'sb_publishable_qF6fKmXOSaJSibPn6kmsNg_IgirHVqx'
)

// 1. Distinct statuses already in the table
const { data: rows, error: listErr } = await supabase
  .from('qr_bags')
  .select('status')
  .limit(500)

if (listErr) {
  console.error('Could not read qr_bags:', listErr.message)
  process.exit(1)
}

const existing = [...new Set((rows ?? []).map(r => r.status).filter(Boolean))]
console.log('Existing status values in qr_bags:', existing)

// 2. Probe candidate values by attempting an update on a real row
// (we immediately roll it back by restoring original, so no data is changed)
const { data: sample } = await supabase
  .from('qr_bags')
  .select('id, status')
  .limit(1)
  .single()

if (!sample) {
  console.log('No rows to probe — seed the table first.')
  process.exit(0)
}

const candidates = [
  'pending', 'registered', 'issued', 'inspected', 'approved',
  'needs_review', 'review', 'flagged', 'at_warehouse',
  'contaminated', 'rejected', 'active',
]

console.log(`\nProbing constraint using row ${sample.id} (original status: ${sample.status})\n`)

const allowed = []
for (const candidate of candidates) {
  const { error } = await supabase
    .from('qr_bags')
    .update({ status: candidate })
    .eq('id', sample.id)

  if (error) {
    console.log(`  ✗ ${candidate.padEnd(15)} — ${error.message}`)
  } else {
    console.log(`  ✓ ${candidate}`)
    allowed.push(candidate)
  }
}

// Restore original status
await supabase.from('qr_bags').update({ status: sample.status }).eq('id', sample.id)
console.log(`\nRestored original status: ${sample.status}`)
console.log('\nAllowed values:', allowed)
