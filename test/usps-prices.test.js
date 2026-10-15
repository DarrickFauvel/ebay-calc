import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deflateRawSync } from 'node:zlib'
import {
  changeId, currentChange, diffRates, parseGaCommercialCsv, parsePriceChangePage, readZipEntry
} from '../src/lib/usps-prices.js'

const PAGE = `
<h1 id="TimeLimitedPriceChangeSection" class="h-with-subtitle">Time-Limited 2026 Price Change</h1>
<div>Starting October 4, 2026 through January 17, 2027</div>
<table>
  <tr><td><a href="/resources/PriceChange/Time-Limited OCT 2026 Price Change - Notice 123 - Final.zip">Time-Limited 2026 Price Files - CSV</a></td><td>Final</td><td>09/18/2026</td></tr>
  <tr><td><a href="/resources/PriceChange/Log.xlsx">Time-Limited 2026 Price Files Change Log</a></td><td></td><td>08/28/2026</td></tr>
</table>
<h1 id="JulyPriceChangeSection" class="h-with-subtitle">July 2026 Price Change</h1>
<div>Effective July 12, 2026</div>
<table>
  <tr><td><a href="/resources/PriceChange/July 2026 Price Change - 07082026 - Notice 123.zip">July 2026 Price Files - CSV</a></td><td>Final</td><td>07/09/2026</td></tr>
</table>
<h1>January 2027 Price Change</h1>
<div>Effective January 18, 2027</div>
<table>
  <tr><td><a href="/resources/PriceChange/Jan 2027.zip">January 2027 Price Files - CSV</a></td><td>Proposed</td><td>11/01/2026</td></tr>
</table>`

test('parses price changes from the USPS price-change page', () => {
  const [tl, july, jan] = parsePriceChangePage(PAGE)
  assert.equal(tl.title, 'Time-Limited 2026 Price Change')
  assert.equal(tl.start, '2026-10-04')
  assert.equal(tl.end, '2027-01-17')
  assert.equal(tl.status, 'Final')
  assert.equal(tl.csvUrl, 'https://pe.usps.com/resources/PriceChange/Time-Limited%20OCT%202026%20Price%20Change%20-%20Notice%20123%20-%20Final.zip')
  assert.equal(changeId(tl), 'Time-Limited 2026 Price Change|09/18/2026')
  assert.equal(july.start, '2026-07-12')
  assert.equal(july.end, null)
  assert.equal(jan.status, 'Proposed')
})

test('currentChange picks the final change in effect and the next scheduled one', () => {
  const changes = parsePriceChangePage(PAGE)
  let { current, upcoming } = currentChange(changes, '2026-10-15')
  assert.equal(current.title, 'Time-Limited 2026 Price Change')
  assert.equal(upcoming.title, 'January 2027 Price Change')
  ;({ current } = currentChange(changes, '2026-09-01'))
  assert.equal(current.title, 'July 2026 Price Change')
  // After the time-limited window closes, the standing July prices apply again.
  ;({ current, upcoming } = currentChange(changes, '2027-01-17'))
  assert.equal(current.title, 'Time-Limited 2026 Price Change')
  ;({ current } = currentChange(changes, '2027-01-18'))
  assert.equal(current.title, 'July 2026 Price Change') // January is only proposed
})

const CSV = [
  'USPS Ground Advantage,Final,,9/14/2026',
  'Commercial,,,,,,,,,',
  'Weight Not Over (ounces),Zones,,,,,,,,',
  ',Zone 1,Zone 2,Zone 3,Zone 4,Zone 5,Zone 6,Zone 7,Zone 8,Zone 9',
  ...['4', '8', '12', '15.999000000000001'].map((w) => `${w},7.33,7.34,7.70,7.86,8.24,8.41,8.62,8.95,8.95`),
  'Weight Not Over (pounds),-,-,-,-,-,-,-,-,-',
  ...Array.from({ length: 8 }, (_, i) => `${i + 1},${[1, 2, 3, 4, 5, 6, 7, 8].map((z) => (8 + i + z / 10).toFixed(2)).join(',')},99`),
  'Oversized,112.94,124.88,142.74,172.58,206.59,236.37,266.08,295.93,295.93',
  'Dimension Noncompliance Fee,3.00'
].join('\r\n')

test('parses the Ground Advantage Commercial CSV into [max_oz, zone1…8] rows', () => {
  const rows = parseGaCommercialCsv(CSV)
  assert.equal(rows.length, 12)
  assert.deepEqual(rows[0], [4, 7.33, 7.34, 7.7, 7.86, 8.24, 8.41, 8.62, 8.95])
  assert.equal(rows[3][0], 15.999)
  assert.deepEqual(rows[4], [16, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8])
  assert.equal(rows.at(-1)[0], 128)
  assert.throws(() => parseGaCommercialCsv(CSV.replace('Commercial', 'Retail')), /layout/)
})

test('diffRates separates unedited changes, edited conflicts and new cells', () => {
  const table = [[4, 1, 2], [8, 3, 4]]
  const rows = [
    { max_oz: 4, zone: 1, price: 1, edited: 0 },
    { max_oz: 4, zone: 2, price: 2.5, edited: 0 },
    { max_oz: 8, zone: 1, price: 2.75, edited: 1 }
  ]
  assert.deepEqual(diffRates(table, rows), { changed: 1, conflicts: 1, added: 1 })
})

// Minimal zip writer for the test: one deflated entry.
function zip (name, content) {
  const data = deflateRawSync(Buffer.from(content))
  const n = Buffer.from(name)
  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8)
  local.writeUInt32LE(data.length, 18); local.writeUInt16LE(n.length, 26)
  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10)
  central.writeUInt32LE(data.length, 20); central.writeUInt16LE(n.length, 28)
  const cdOffset = local.length + n.length + data.length
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10)
  eocd.writeUInt32LE(central.length + n.length, 12); eocd.writeUInt32LE(cdOffset, 16)
  return Buffer.concat([local, n, data, central, n, eocd])
}

test('readZipEntry inflates a named entry', () => {
  const buf = zip('USPS Ground Advantage Comm.csv', CSV)
  assert.equal(readZipEntry(buf, /Ground Advantage Comm\.csv$/).toString(), CSV)
  assert.equal(readZipEntry(buf, /Retail/), null)
})
