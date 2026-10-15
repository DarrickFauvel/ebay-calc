// Worst-case (furthest) lower-48 USPS zone from an origin ZIP.

const ZONE_CHART_URL = 'https://postcalc.usps.com/DomesticZoneChart/GetZoneChart'

// ZIP3 prefixes outside the contiguous US: PR/VI, military (AA/AE/AP),
// Hawaii, Guam & Pacific territories, Alaska.
const NON_CONTIGUOUS = [
  [6, 9], [90, 99], [340, 340], [962, 969], [995, 999]
]

export const isContiguous = (zip3) =>
  !NON_CONTIGUOUS.some(([lo, hi]) => zip3 >= lo && zip3 <= hi)

/** Parse "123", "123---456" or a 5-digit "96700" entry into a ZIP3 range [lo, hi]. */
const parseRange = (s) => {
  const [lo, hi = lo] = s.split(/-+/).map((n) => {
    const digits = n.trim()
    return parseInt(digits.length > 3 ? digits.slice(0, 3) : digits, 10)
  })
  return [lo, hi]
}

/** Max zone among contiguous destinations in a USPS zone-chart response. */
export function maxContiguousZone (chart) {
  let max = 0
  for (const col of ['Column0', 'Column1', 'Column2', 'Column3']) {
    for (const { ZipCodes, Zone } of chart[col] ?? []) {
      const zone = parseInt(Zone, 10)
      if (!zone) continue
      const [lo, hi] = parseRange(ZipCodes)
      for (let z = lo; z <= hi; z++) {
        if (isContiguous(z)) { max = Math.max(max, zone); break }
      }
    }
  }
  return max || null
}

/**
 * Zone from a USPS zone chart to one destination ZIP. 5-digit exceptions win;
 * service-specific ones (Priority, light Ground Advantage to APO etc.) are skipped.
 */
export function zoneForZip (chart, destZip) {
  const zip = String(destZip).trim()
  if (!/^\d{5}$/.test(zip)) return null
  const zip5 = parseInt(zip, 10)
  for (const { ZipCodes, Zone, MailService } of chart.Zip5Digit ?? []) {
    if (MailService) continue
    const [lo, hi = lo] = ZipCodes.split(/-+/).map((n) => parseInt(n, 10))
    if (zip5 >= lo && zip5 <= hi) return parseInt(Zone, 10) || null
  }
  const zip3 = parseInt(zip.slice(0, 3), 10)
  for (const col of ['Column0', 'Column1', 'Column2', 'Column3']) {
    for (const { ZipCodes, Zone } of chart[col] ?? []) {
      const [lo, hi] = parseRange(ZipCodes)
      if (zip3 >= lo && zip3 <= hi) return parseInt(Zone, 10) || null
    }
  }
  return null
}

const zip3Of = (originZip) => {
  const zip3 = String(originZip).trim().slice(0, 3)
  if (!/^\d{3}$/.test(zip3)) throw new Error('Enter a valid 5-digit ZIP code')
  return zip3
}

// Charts change rarely; cache per origin ZIP3 for a day so the calculator can look up every keystroke.
const charts = new Map()
const CHART_TTL = 24 * 60 * 60 * 1000

export async function fetchZoneChart (originZip, { signal } = {}) {
  const zip3 = zip3Of(originZip)
  const hit = charts.get(zip3)
  if (hit && Date.now() - hit.at < CHART_TTL) return hit.chart
  const d = new Date()
  const date = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
  const url = `${ZONE_CHART_URL}?zipCode3Digit=${zip3}&shippingDate=${encodeURIComponent(date)}`
  // The endpoint rejects requests without a browser-like user agent.
  const res = await fetch(url, {
    signal: signal ?? AbortSignal.timeout(10_000),
    headers: { 'User-Agent': 'Mozilla/5.0 (ebay-calc)', Accept: 'application/json' }
  })
  if (!res.ok) throw new Error(`USPS zone chart returned ${res.status}`)
  const chart = await res.json()
  if (chart.ZIPCodeError) throw new Error(chart.ZIPCodeError)
  charts.set(zip3, { chart, at: Date.now() })
  return chart
}

export async function fetchUspsMaxZone (originZip, opts) {
  const chart = await fetchZoneChart(originZip, opts)
  const zone = maxContiguousZone(chart)
  if (!zone) throw new Error('No zones found in USPS response')
  return { zone, effectiveDate: chart.EffectiveDate }
}
