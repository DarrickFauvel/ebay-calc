// Checks USPS for a newer Ground Advantage price table and applies it on request.
import { db, getRateSource, updateRateSource } from '../db/client.js'
import { rateRows } from '../db/seed.js'
import {
  changeId, currentChange, diffRates, fetchGaCommercialTable, fetchPriceChanges
} from './usps-prices.js'

const SERVICE = 'usps_ga'
const STALE_MS = 24 * 60 * 60 * 1000

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
const label = (c) => `${c.title} (${c.dates})`

let running = null

/** Look for a newer USPS table. Never throws; failures are stored in check_error. */
export function checkRateUpdates ({ force = false } = {}) {
  running ??= check(force).finally(() => { running = null })
  return running
}

/** Check if the last check is older than a day; resolves to the source row, or null if fresh. */
export async function checkIfStale () {
  const src = await getRateSource(SERVICE)
  const stale = !src.checked_at || Date.now() - Date.parse(src.checked_at) > STALE_MS
  return stale ? checkRateUpdates() : null
}

async function check (force) {
  const checked_at = new Date().toISOString()
  try {
    const src = await getRateSource(SERVICE)
    const { current, upcoming } = currentChange(await fetchPriceChanges(), today())
    if (!current) throw new Error('No current USPS price change found')
    const id = changeId(current)
    const upcoming_label = upcoming ? label(upcoming) : null

    if (!force && (id === src.installed_id || id === src.pending_id)) {
      await updateRateSource(SERVICE, { upcoming_label, checked_at, check_error: null })
      return getRateSource(SERVICE)
    }

    const table = await fetchGaCommercialTable(current.csvUrl)
    const { rows } = await db.execute({ sql: 'SELECT max_oz, zone, price, edited FROM rates WHERE service = ?', args: [SERVICE] })
    const diff = diffRates(table, rows)

    if (diff.changed + diff.added === 0) {
      // Already matches (edits aside): record it as installed, nothing to announce.
      await updateRateSource(SERVICE, {
        installed_id: id, installed_label: label(current), ...NO_PENDING, upcoming_label, checked_at, check_error: null
      })
    } else {
      await updateRateSource(SERVICE, {
        pending_id: id,
        pending_label: label(current),
        pending_json: JSON.stringify(table),
        pending_changed: diff.changed + diff.added,
        pending_conflicts: diff.conflicts,
        upcoming_label,
        checked_at,
        check_error: null
      })
    }
  } catch (err) {
    await updateRateSource(SERVICE, { checked_at, check_error: err.message })
  }
  return getRateSource(SERVICE)
}

// updateRateSource only writes the columns it's given, so clearing means passing nulls.
const NO_PENDING = {
  pending_id: null, pending_label: null, pending_json: null, pending_changed: null, pending_conflicts: null
}

/**
 * Apply the pending table. Cells you edited are kept unless overwriteEdits;
 * UPS placeholder cells follow along, but edited UPS cells are never touched.
 */
export async function applyRateUpdate ({ overwriteEdits = false } = {}) {
  const src = await getRateSource(SERVICE)
  if (!src.pending_json) return 0
  const upsert = `INSERT INTO rates (service, max_oz, zone, price) VALUES (?, ?, ?, ?)
    ON CONFLICT (service, max_oz, zone) DO UPDATE SET price = excluded.price, edited = 0
    WHERE rates.edited = 0 OR ?`
  const stmts = rateRows(JSON.parse(src.pending_json)).map(([service, maxOz, zone, price]) => ({
    sql: upsert,
    args: [service, maxOz, zone, price, service === SERVICE && overwriteEdits ? 1 : 0]
  }))
  await db.batch(stmts, 'write')
  await updateRateSource(SERVICE, {
    installed_id: src.pending_id,
    installed_label: src.pending_label,
    ...NO_PENDING
  })
  return src.pending_changed + (overwriteEdits ? src.pending_conflicts : 0)
}

export async function dismissRateUpdate () {
  const src = await getRateSource(SERVICE)
  await updateRateSource(SERVICE, { dismissed_id: src.pending_id })
}

/** The pending update to announce in the toast, or null. */
export async function toastUpdate () {
  const src = await getRateSource(SERVICE)
  return src.pending_id && src.pending_id !== src.dismissed_id ? src : null
}
