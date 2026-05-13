import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://huomxfmgpjsiylftisxq.supabase.co',
  'sb_publishable_qF6fKmXOSaJSibPn6kmsNg_IgirHVqx'
)

const { error: authErr } = await supabase.auth.signInWithPassword({
  email:    'apbailey2q@yahoo.com',
  password: 'Baykid2025!',
})
if (authErr) { console.error('Login failed:', authErr.message); process.exit(1) }

const { data: rows, error: rowErr } = await supabase.from('qr_bags').select('id, bag_code, status').limit(3)
if (rowErr) { console.error('Cannot read qr_bags:', rowErr.message); process.exit(1) }
if (!rows?.length) { console.log('No rows found — check RLS read policy.'); process.exit(0) }

const sample = rows[0]
console.log(`Probing with row: ${sample.bag_code} (current status: "${sample.status}")\n`)

const candidates = [
  'pending', 'registered', 'issued', 'active',
  'inspected', 'approved', 'completed', 'recycled',
  'at_warehouse', 'needs_review', 'flagged', 'review',
  'contaminated', 'rejected', 'quarantine',
]

const allowed = []
for (const val of candidates) {
  const { error } = await supabase.from('qr_bags').update({ status: val }).eq('id', sample.id)
  if (error) {
    console.log(`  ✗ ${val.padEnd(18)} — ${error.message}`)
  } else {
    console.log(`  ✓ ${val}`)
    allowed.push(val)
  }
}

await supabase.from('qr_bags').update({ status: sample.status }).eq('id', sample.id)
console.log(`\nRestored original: "${sample.status}"`)
console.log('\nALLOWED:', allowed.join(', '))
