// Seeds settings, rate tables and category presets.
// Runs automatically on first boot; `npm run seed` (--force) resets rates & categories.
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { db, migrate } from './client.js'

// USPS Ground Advantage — Commercial, from USPS Notice 123 (effective Oct 4, 2026).
// Rows: [max_oz, zone1 … zone8]. eBay label prices may be lower — edit on /rates.
const SEED_LABEL = 'Notice 123, effective Oct 4, 2026'
const uspsGa = JSON.parse(readFileSync(new URL('./usps-ga-commercial.json', import.meta.url)))
// USPS Media Mail, single piece, same notice. Rows: [max_oz, price]. Not zoned, no dim weight.
const uspsMedia = JSON.parse(readFileSync(new URL('./usps-media.json', import.meta.url)))
const mediaRows = () => uspsMedia.map(([maxOz, price]) => ({
  sql: 'INSERT OR IGNORE INTO rates (service, max_oz, zone, price) VALUES (?, ?, ?, ?)',
  args: ['usps_media', maxOz, 1, price]
}))

// eBay fee presets — verify against https://www.ebay.com/help/selling/fees-credits-invoices/selling-fees
// [name, fvf %, tier threshold $, % above threshold, waives per-order fee]
const CATEGORIES = [
  ['Most categories', 13.6, 7500, 2.35, 0],
  ['Books, Movies & Music', 15.3, 7500, 2.35, 0],
  ['Clothing, Shoes & Accessories', 13.6, 7500, 2.35, 0],
  ['Athletic Shoes ($150+)', 8, null, null, 1],
  ["Women's Bags & Handbags", 15, 2000, 9, 0],
  ['Jewelry', 15, 5000, 9, 0],
  ['Watches', 15, 1000, 6.5, 0],
  ['Trading Cards & Collectible Card Games', 13.25, 7500, 2.35, 0],
  ['Guitars & Basses', 6.7, 7500, 2.35, 0],
  ['Heavy Equipment & Commercial Trucks', 3, null, null, 0]
]

/** [service, max_oz, zone, price] rows for a USPS GA table, plus the UPS placeholder mirror. */
export function rateRows (table = uspsGa) {
  const rows = []
  for (const [maxOz, ...zones] of table) {
    zones.forEach((price, i) => rows.push(['usps_ga', maxOz, i + 1, price]))
    // UPS Ground placeholder: mirrors GA at 1 lb+ (UPS bills a 1 lb minimum).
    // Replace with your eBay UPS label prices on /rates.
    if (maxOz >= 16) zones.slice(1).forEach((price, i) => rows.push(['ups_ground', maxOz, i + 2, price]))
  }
  return rows
}

export async function seed ({ force = false } = {}) {
  await migrate()
  const { rows: [{ n }] } = await db.execute('SELECT COUNT(*) AS n FROM rates')
  if (n > 0 && !force) {
    await db.batch(mediaRows(), 'write') // DBs seeded before Media Mail existed; keeps edited prices
    return false
  }

  const stmts = [
    'DELETE FROM rates',
    'DELETE FROM categories',
    'DELETE FROM rate_source',
    { sql: 'INSERT INTO rate_source (service, installed_label) VALUES (?, ?)', args: ['usps_ga', SEED_LABEL] },
    ...rateRows().map((args) => ({
      sql: 'INSERT INTO rates (service, max_oz, zone, price) VALUES (?, ?, ?, ?)',
      args
    })),
    ...mediaRows(),
    ...CATEGORIES.map((c, i) => ({
      sql: 'INSERT INTO categories (name, fvf_pct, tier_threshold, tier_pct, no_per_order, sort) VALUES (?, ?, ?, ?, ?, ?)',
      args: [...c, i]
    })),
    'INSERT OR IGNORE INTO settings (id) VALUES (1)',
    'UPDATE settings SET category_id = (SELECT id FROM categories ORDER BY sort LIMIT 1)'
  ]
  await db.batch(stmts, 'write')
  return true
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const force = process.argv.includes('--force')
  const seeded = await seed({ force })
  console.log(seeded ? 'Seeded rates, categories and settings.' : 'Already seeded (use --force to reset).')
}
