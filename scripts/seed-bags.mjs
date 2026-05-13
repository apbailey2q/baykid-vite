// Inserts QR bag codes 210050541819 through 210050541936 into Supabase qr_bags.
// Run with: node scripts/seed-bags.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://huomxfmgpjsiylftisxq.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ?? 'sb_publishable_qF6fKmXOSaJSibPn6kmsNg_IgirHVqx'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const START  = 1819
const END    = 1936
const PREFIX = '21005054'

const bags = []
for (let i = START; i <= END; i++) {
  bags.push({ bag_code: `${PREFIX}${i}`, status: 'registered' })
}

console.log(`Inserting ${bags.length} bags (${PREFIX}${START} → ${PREFIX}${END})…`)

const { data, error } = await supabase
  .from('qr_bags')
  .upsert(bags, { onConflict: 'bag_code', ignoreDuplicates: true })
  .select('bag_code')

if (error) {
  console.error('Insert failed:', error.message)
  console.error('Details:', error.details ?? error.hint ?? '')
  process.exit(1)
} else {
  console.log(`Done — ${(data ?? []).length} rows inserted/confirmed.`)
}
