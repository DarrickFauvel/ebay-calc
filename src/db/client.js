import { createClient } from '@libsql/client'

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN
})

export const SERVICES = {
  usps_ga: { name: 'USPS Ground Advantage', zones: [1, 2, 3, 4, 5, 6, 7, 8] },
  ups_ground: { name: 'UPS Ground', zones: [2, 3, 4, 5, 6, 7, 8] }
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    origin_zip TEXT NOT NULL DEFAULT '01510',
    usps_zone INTEGER NOT NULL DEFAULT 8,
    ups_zone INTEGER NOT NULL DEFAULT 8,
    ups_dim_divisor INTEGER NOT NULL DEFAULT 139,
    tax_pct REAL NOT NULL DEFAULT 7.5,
    category_id INTEGER,
    zone_checked_at TEXT,
    usps_discount_pct REAL NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS rates (
    id INTEGER PRIMARY KEY,
    service TEXT NOT NULL,
    max_oz REAL NOT NULL,
    zone INTEGER NOT NULL,
    price REAL NOT NULL,
    edited INTEGER NOT NULL DEFAULT 0,
    UNIQUE (service, max_oz, zone)
  )`,
  `CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    fvf_pct REAL NOT NULL,
    tier_threshold REAL,
    tier_pct REAL,
    no_per_order INTEGER NOT NULL DEFAULT 0,
    sort INTEGER NOT NULL DEFAULT 0
  )`,
  // Last calculator inputs, restored on the next visit (any device).
  `CREATE TABLE IF NOT EXISTS last_inputs (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    cost REAL,
    target_profit REAL,
    lb REAL,
    oz REAL,
    length REAL,
    width REAL,
    height REAL,
    mode TEXT,
    list_price REAL,
    ship_zip TEXT,
    label_cost REAL
  )`,
  // Where each service's rate table came from, and any newer published table waiting to be applied.
  `CREATE TABLE IF NOT EXISTS rate_source (
    service TEXT PRIMARY KEY,
    installed_id TEXT,
    installed_label TEXT,
    pending_id TEXT,
    pending_label TEXT,
    pending_json TEXT,
    pending_changed INTEGER,
    pending_conflicts INTEGER,
    dismissed_id TEXT,
    upcoming_label TEXT,
    checked_at TEXT,
    check_error TEXT
  )`
]

export async function migrate () {
  await db.batch(SCHEMA, 'write')
  // Columns added after a table first shipped; CREATE TABLE IF NOT EXISTS won't add them.
  const { rows } = await db.execute('PRAGMA table_info(settings)')
  if (!rows.some((r) => r.name === 'usps_discount_pct')) {
    await db.execute('ALTER TABLE settings ADD COLUMN usps_discount_pct REAL NOT NULL DEFAULT 0')
  }
  const { rows: last } = await db.execute('PRAGMA table_info(last_inputs)')
  for (const [name, type] of [['mode', 'TEXT'], ['list_price', 'REAL'], ['ship_zip', 'TEXT'], ['label_cost', 'REAL']]) {
    if (!last.some((r) => r.name === name)) await db.execute(`ALTER TABLE last_inputs ADD COLUMN ${name} ${type}`)
  }
}

export async function getSettings () {
  const { rows } = await db.execute('SELECT * FROM settings WHERE id = 1')
  return rows[0]
}

export async function updateSettings (s) {
  await db.execute({
    sql: `UPDATE settings SET origin_zip = ?, usps_zone = ?, ups_zone = ?, ups_dim_divisor = ?,
          tax_pct = ?, category_id = ?, usps_discount_pct = ?, zone_checked_at = COALESCE(?, zone_checked_at) WHERE id = 1`,
    args: [s.origin_zip, s.usps_zone, s.ups_zone, s.ups_dim_divisor, s.tax_pct, s.category_id, s.usps_discount_pct, s.zone_checked_at ?? null]
  })
}

export async function listCategories () {
  const { rows } = await db.execute('SELECT * FROM categories ORDER BY sort, name')
  return rows
}

export async function getCategory (id) {
  const { rows } = await db.execute({ sql: 'SELECT * FROM categories WHERE id = ?', args: [id] })
  return rows[0]
}

export async function getLastInputs () {
  const { rows } = await db.execute('SELECT cost, target_profit, lb, oz, length, width, height, mode, list_price, ship_zip, label_cost FROM last_inputs WHERE id = 1')
  return rows[0] ?? null
}

export async function saveLastInputs ({ cost, targetProfit, lb, oz, length, width, height, mode, listPrice, shipZip, labelCost }) {
  await db.execute({
    sql: `INSERT INTO last_inputs (id, cost, target_profit, lb, oz, length, width, height, mode, list_price, ship_zip, label_cost) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET cost = excluded.cost, target_profit = excluded.target_profit,
          lb = excluded.lb, oz = excluded.oz, length = excluded.length, width = excluded.width, height = excluded.height,
          mode = excluded.mode, list_price = excluded.list_price, ship_zip = excluded.ship_zip, label_cost = excluded.label_cost`,
    args: [cost, targetProfit, lb, oz, length, width, height, mode, listPrice, shipZip, labelCost]
  })
}

export async function getRateSource (service) {
  const { rows } = await db.execute({ sql: 'SELECT * FROM rate_source WHERE service = ?', args: [service] })
  return rows[0] ?? { service }
}

export async function updateRateSource (service, fields) {
  const cols = Object.keys(fields)
  await db.execute({
    sql: `INSERT INTO rate_source (service, ${cols.join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')})
          ON CONFLICT (service) DO UPDATE SET ${cols.map((c) => `${c} = excluded.${c}`).join(', ')}`,
    args: [service, ...cols.map((c) => fields[c] ?? null)]
  })
}

/** All weight steps for one service + zone. */
export async function ratesForZone (service, zone) {
  const { rows } = await db.execute({
    sql: 'SELECT max_oz, price, edited FROM rates WHERE service = ? AND zone = ? ORDER BY max_oz',
    args: [service, zone]
  })
  return rows
}

/** Grid for the rates editor: [{ max_oz, cells: { [zone]: { id, price } } }] */
export async function rateGrid (service) {
  const { rows } = await db.execute({
    sql: 'SELECT id, max_oz, zone, price, edited FROM rates WHERE service = ? ORDER BY max_oz, zone',
    args: [service]
  })
  const byWeight = new Map()
  for (const r of rows) {
    if (!byWeight.has(r.max_oz)) byWeight.set(r.max_oz, { max_oz: r.max_oz, cells: {} })
    byWeight.get(r.max_oz).cells[r.zone] = r
  }
  return [...byWeight.values()]
}
