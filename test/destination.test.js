import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fillTax } from '../src/lib/quote.js'
import { stateForZip } from '../src/lib/states.js'
import { zoneForZip } from '../src/lib/zones.js'

// Shape of postcalc.usps.com/DomesticZoneChart/GetZoneChart for origin 015.
const chart = {
  Column0: [
    { ZipCodes: '005', Zone: '2', MailService: '' },
    { ZipCodes: '010---011', Zone: '1*', MailService: '' },
    { ZipCodes: '020---024', Zone: '2', MailService: '' }
  ],
  Column1: [{ ZipCodes: '900---908', Zone: '8', MailService: '' }],
  Column2: [{ ZipCodes: '969', Zone: '9', MailService: '' }],
  Column3: [],
  Zip5Digit: [
    { ZipCodes: '96900---96938', Zone: '8', MailService: '' },
    { ZipCodes: '90000---90099', Zone: '5', MailService: 'Priority Mail service' }
  ]
}

test('zoneForZip looks up a destination by ZIP3, with 5-digit exceptions first', () => {
  assert.equal(zoneForZip(chart, '02134'), 2)
  assert.equal(zoneForZip(chart, '01001'), 1) // "1*" → 1
  assert.equal(zoneForZip(chart, '90001'), 8) // service-specific exception ignored
  assert.equal(zoneForZip(chart, '96910'), 8) // 5-digit exception beats ZIP3 zone 9
  assert.equal(zoneForZip(chart, '96950'), 9)
  assert.equal(zoneForZip(chart, '3000'), null)
  assert.equal(zoneForZip(chart, '30301'), null)
})

test('stateForZip maps ZIP prefixes to states and base tax rates', () => {
  assert.deepEqual(stateForZip('02134'), { state: 'MA', taxPct: 6.25 })
  assert.deepEqual(stateForZip('05501'), { state: 'MA', taxPct: 6.25 }) // Andover IRS
  assert.equal(stateForZip('73301').state, 'TX') // Austin IRS
  assert.equal(stateForZip('97201').taxPct, 0) // Oregon
  assert.equal(stateForZip('99501').state, 'AK')
  assert.equal(stateForZip('00000'), null)
  assert.equal(stateForZip('021'), null)
})

test('fillTax fills state tax once per ZIP and restores the default when cleared', () => {
  const settings = { tax_pct: 7.5 }
  const ma = { zip: '02134', state: 'MA', taxPct: 6.25, zone: 2 }
  assert.deepEqual(fillTax({ shipZip: '02134', taxZip: '' }, ma, settings), { taxPct: 6.25, taxZip: '02134' })
  assert.equal(fillTax({ shipZip: '02134', taxZip: '02134' }, ma, settings), null) // user may edit it now
  assert.equal(fillTax({ shipZip: '021', taxZip: '' }, null, settings), null)
  assert.deepEqual(fillTax({ shipZip: '', taxZip: '02134' }, null, settings), { taxPct: 7.5, taxZip: '' })
})

test('pickBest skips UPS without box size and worst-zone estimates for a ship-to ZIP', async () => {
  const { pickBest } = await import('../src/lib/quote.js')
  const ups = { key: 'ups_ground', price: 7, worstZone: true, needsDims: true }
  const usps = { key: 'usps_ga', price: 8, worstZone: false, needsDims: false }
  assert.equal(pickBest([ups, usps]), usps)
  assert.equal(pickBest([{ ...ups, needsDims: false }, usps]).key, 'ups_ground')
  assert.equal(pickBest([{ ...ups, needsDims: false }, usps], { uspsZone: 5 }), usps)
  assert.equal(pickBest([ups, { ...usps, price: null }]), ups) // nothing better: fall back
  assert.equal(pickBest([{ ...usps, price: null }]), null)
})
