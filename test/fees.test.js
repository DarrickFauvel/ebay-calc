import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  billableOz, breakdown, calculate, charmPrice, finalValueFee, lookupRate, round2, solvePrice, USPS_DIM
} from '../src/lib/fees.js'
import { isContiguous, maxContiguousZone } from '../src/lib/zones.js'

const most = { fvf_pct: 13.6, tier_threshold: 7500, tier_pct: 2.35, no_per_order: 0 }
const near = (a, b, eps = 0.005) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`)

test('final value fee applies tiers above the threshold', () => {
  near(finalValueFee(100, most), 13.6)
  near(finalValueFee(10000, most), 7500 * 0.136 + 2500 * 0.0235)
  near(finalValueFee(100, { fvf_pct: 8 }), 8)
})

test('breakdown charges FVF on price + sales tax and the right per-order fee', () => {
  const r = breakdown({ price: 100, cost: 20, shipping: 8, taxPct: 10, category: most })
  near(r.salesTax, 10)
  near(r.fvf, 110 * 0.136)
  near(r.perOrder, 0.4)
  near(r.profit, 100 - 14.96 - 0.4 - 8 - 20)

  near(breakdown({ price: 9, taxPct: 0, category: most }).perOrder, 0.3)
  near(breakdown({ price: 200, category: { ...most, no_per_order: 1 } }).perOrder, 0)
})

test('solvePrice returns the lowest cent price that meets the target profit', () => {
  for (const [targetProfit, cost, shipping, taxPct] of [[10, 5, 9.29, 7.5], [0, 0, 7.33, 0], [250, 1000, 42.14, 9], [3, 1, 4, 0]]) {
    const price = solvePrice({ targetProfit, cost, shipping, taxPct, category: most })
    const at = (p) => breakdown({ price: p, cost, shipping, taxPct, category: most }).profit
    assert.ok(at(price) >= targetProfit - 1e-9, `profit at ${price} below target`)
    assert.ok(at(price - 0.01) < targetProfit, `${price - 0.01} would also work`)
  }
})

test('solvePrice handles crossing the FVF tier threshold', () => {
  const price = solvePrice({ targetProfit: 7000, cost: 1000, shipping: 50, category: most })
  const r = breakdown({ price, cost: 1000, shipping: 50, category: most })
  assert.ok(price > 7500)
  assert.ok(r.profit >= 7000 && r.profit < 7000.02)
})

test('calculate reports a shipping pad larger than the label (fees on shipping)', () => {
  const r = calculate({ mode: 'profit', targetProfit: 10, cost: 5, shipping: 10, taxPct: 7.5, category: most })
  assert.ok(r.shipPad > 10, `pad ${r.shipPad} should exceed label cost`)
  near(r.shipPad, 10 / (1 - 0.136 * 1.075), 0.02)
  assert.equal(r.charm % 1 > 0.98, true)
})

test('calculate in price mode evaluates the given price', () => {
  const r = calculate({ mode: 'price', listPrice: 30, cost: 5, shipping: 9, taxPct: 0, category: most })
  near(r.price, 30)
  near(r.profit, 30 - 30 * 0.136 - 0.4 - 9 - 5)
})

test('charmPrice rounds up to .99', () => {
  near(charmPrice(12.4), 12.99)
  near(charmPrice(12.99), 12.99)
  near(charmPrice(12.995), 13.99)
})

test('billable weight uses dim weight only above the threshold', () => {
  assert.equal(billableOz({ weightOz: 8, length: 10, width: 8, height: 4 }, USPS_DIM), 8)
  // 14×14×14 = 2744 in³ > 1728 → ceil(2744/166)=17 lb
  assert.equal(billableOz({ weightOz: 32, length: 14, width: 14, height: 14 }, USPS_DIM), 17 * 16)
  assert.equal(billableOz({ weightOz: 32, length: 12, width: 12, height: 12 }, { divisor: 139 }), 13 * 16)
})

test('lookupRate picks the first weight step that fits', () => {
  const rows = [{ max_oz: 16, price: 8 }, { max_oz: 4, price: 5 }, { max_oz: 32, price: 10 }]
  assert.equal(lookupRate(rows, 3).price, 5)
  assert.equal(lookupRate(rows, 4).price, 5)
  assert.equal(lookupRate(rows, 4.1).price, 8)
  assert.equal(lookupRate(rows, 33), null)
})

test('max zone ignores AK/HI/territories/military', () => {
  assert.equal(isContiguous(995), false)
  assert.equal(isContiguous(967), false)
  assert.equal(isContiguous(7), false)
  assert.equal(isContiguous(100), true)
  const chart = {
    Column0: [{ ZipCodes: '006---009', Zone: '9' }, { ZipCodes: '100', Zone: '4' }],
    Column1: [{ ZipCodes: '980---994', Zone: '8*' }, { ZipCodes: '995---999', Zone: '9' }]
  }
  assert.equal(maxContiguousZone(chart), 8)
  // 5-digit entries (e.g. Hawaii's 96700) must map to their ZIP3
  const fromKansas = { Column0: [{ ZipCodes: '980---986', Zone: '7' }], Column1: [{ ZipCodes: '96700', Zone: '8' }] }
  assert.equal(maxContiguousZone(fromKansas), 7)
})

test('sales tax is charged to the cent (Massachusetts 6.25%)', () => {
  const r = breakdown({ price: 24.99, taxPct: 6.25, category: most })
  assert.equal(r.salesTax, 1.56) // 1.561875 → 1.56
  near(r.orderTotal, 26.55, 1e-9)
  near(r.fvf, 26.55 * 0.136, 1e-9)
})

test('solvePrice stays the lowest cent with cent-rounded tax', () => {
  const base = { cost: 3.17, shipping: 8.95, taxPct: 6.25, category: most }
  for (let t = 0; t <= 40; t += 0.37) {
    const price = solvePrice({ ...base, targetProfit: t })
    assert.ok(breakdown({ ...base, price }).profit >= t - 1e-9, `profit at ${price} < ${t}`)
    assert.ok(breakdown({ ...base, price: round2(price - 0.01) }).profit < t - 1e-9, `${price} is not the lowest cent for ${t}`)
  }
})
