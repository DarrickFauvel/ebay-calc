// USPS Ground Advantage Commercial prices from the official Notice 123 price files.
// pe.usps.com/pricechange lists each price change with a zip of CSVs; no API key needed.
import { inflateRawSync } from 'node:zlib'

export const PRICE_CHANGE_URL = 'https://pe.usps.com/pricechange/index'
const UA = 'Mozilla/5.0 (ebay-calc)'

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december']

/** "October 4, 2026" → "2026-10-04" */
const isoDate = (text) => {
  const m = /([a-z]+)\s+(\d{1,2}),\s*(\d{4})/i.exec(text)
  const month = m && MONTHS.indexOf(m[1].toLowerCase())
  if (!m || month < 0) return null
  return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`
}

const stripTags = (s) => s.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()

/**
 * Price changes listed on the USPS price-change page:
 * [{ title, dates, start, end, csvUrl, status, fileDate }]
 */
export function parsePriceChangePage (html, base = PRICE_CHANGE_URL) {
  const changes = []
  for (const section of html.split(/<h1\b/i).slice(1)) {
    const title = stripTags(/^[^>]*>([\s\S]*?)<\/h1>/i.exec(section)?.[1] ?? '')
    const dates = stripTags(/<\/h1>\s*<div[^>]*>([\s\S]*?)<\/div>/i.exec(section)?.[1] ?? '')
    const csv = /<a href="([^"]+)">[^<]*Price Files - CSV<\/a><\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>/i.exec(section)
    if (!title || !csv) continue
    const [from, through] = dates.split(/\bthrough\b/i)
    changes.push({
      title,
      dates,
      start: isoDate(from),
      end: through ? isoDate(through) : null,
      csvUrl: new URL(csv[1], base).href,
      status: csv[2].trim(),
      fileDate: csv[3].trim()
    })
  }
  return changes
}

/** The final price change in effect on `today` (YYYY-MM-DD), plus the next scheduled one. */
export function currentChange (changes, today) {
  const final = changes.filter((c) => c.start && /final/i.test(c.status))
  const current = final
    .filter((c) => c.start <= today && (!c.end || c.end >= today))
    .sort((a, b) => b.start.localeCompare(a.start))[0] ?? null
  const upcoming = changes
    .filter((c) => c.start && c.start > today)
    .sort((a, b) => a.start.localeCompare(b.start))[0] ?? null
  return { current, upcoming }
}

/** Stable id for a price file: a re-published (corrected) file gets a new id. */
export const changeId = (c) => `${c.title}|${c.fileDate}`

/** Extract one file (matched by name) from a zip buffer. Handles stored and deflated entries. */
export function readZipEntry (buf, match) {
  let eocd = buf.length - 22
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--
  if (eocd < 0) throw new Error('Not a zip file')
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Corrupt zip directory')
    const method = buf.readUInt16LE(p + 10)
    const size = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const next = p + 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    if (match.test(name)) {
      const local = buf.readUInt32LE(p + 42)
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
      const data = buf.subarray(start, start + size)
      if (method === 0) return data
      if (method === 8) return inflateRawSync(data)
      throw new Error(`Unsupported zip compression (${method})`)
    }
    p = next
  }
  return null
}

/**
 * "USPS Ground Advantage Comm.csv" → rows of [max_oz, zone1 … zone8],
 * the same shape as src/db/usps-ga-commercial.json.
 */
export function parseGaCommercialCsv (text) {
  const lines = text.split(/\r?\n/)
  if (!/ground advantage/i.test(lines[0]) || !/^commercial/i.test(lines[1] ?? '')) {
    throw new Error('Unexpected Ground Advantage price file layout')
  }
  const rows = []
  let perLb = false
  for (const line of lines.slice(2)) {
    const cells = line.split(',')
    if (/weight not over \(pounds\)/i.test(cells[0])) { perLb = true; continue }
    const weight = Number(cells[0])
    if (cells[0] === '' || !Number.isFinite(weight)) {
      if (rows.length) break // first non-numeric row after the table ("Oversized", fees…)
      continue
    }
    const prices = cells.slice(1, 9).map(Number)
    if (prices.length !== 8 || !prices.every((n) => Number.isFinite(n) && n > 0)) {
      throw new Error(`Bad price row: ${line}`)
    }
    rows.push([Math.round(weight * (perLb ? 16 : 1) * 1000) / 1000, ...prices])
  }
  if (rows.length < 10) throw new Error('Ground Advantage price table looks incomplete')
  return rows
}

/**
 * Compare a price table with the current DB rows ({ max_oz, zone, price, edited }).
 * changed: unedited cells that would change; conflicts: edited cells whose USPS price differs;
 * added: weight/zone cells that don't exist yet.
 */
export function diffRates (table, rows) {
  const have = new Map(rows.map((r) => [`${r.max_oz}|${r.zone}`, r]))
  const diff = { changed: 0, conflicts: 0, added: 0 }
  for (const [maxOz, ...zones] of table) {
    zones.forEach((price, i) => {
      const row = have.get(`${maxOz}|${i + 1}`)
      if (!row) diff.added++
      else if (Math.abs(row.price - price) >= 0.005) diff[row.edited ? 'conflicts' : 'changed']++
    })
  }
  return diff
}

const get = async (url) => {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(20_000),
    headers: { 'User-Agent': UA }
  })
  if (!res.ok) throw new Error(`USPS returned ${res.status} for ${new URL(url).pathname}`)
  return res
}

export async function fetchPriceChanges () {
  return parsePriceChangePage(await (await get(PRICE_CHANGE_URL)).text())
}

export async function fetchGaCommercialTable (csvUrl) {
  const zip = Buffer.from(await (await get(csvUrl)).arrayBuffer())
  const csv = readZipEntry(zip, /Ground Advantage Comm\.csv$/i)
  if (!csv) throw new Error('Ground Advantage Commercial prices not found in the USPS price files')
  return parseGaCommercialCsv(csv.toString('utf8'))
}
