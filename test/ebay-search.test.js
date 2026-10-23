import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

// The extension script isn't a module; run it without a document and pull out its pure helpers.
const code = await readFile(new URL('../extension/ebay-search.js', import.meta.url), 'utf8')
const { parseMoney, parseShipping, parseCount, sellThrough, summarize } = vm.runInNewContext(`${code}\n;({ parseMoney, parseShipping, parseCount, sellThrough, summarize })`)

test('parseMoney reads prices and skips ranges', () => {
  assert.equal(parseMoney('$12.99'), 12.99)
  assert.equal(parseMoney('$1,250.00'), 1250)
  assert.equal(parseMoney('$10.00 to $15.00'), null)
  assert.equal(parseMoney(''), null)
  assert.equal(parseMoney(undefined), null)
})

test('parseShipping reads free, paid and unknown shipping', () => {
  assert.equal(parseShipping('Sold Oct 2 $20.00 Free delivery'), 0)
  assert.equal(parseShipping('$20.00 +$5.25 delivery'), 5.25)
  assert.equal(parseShipping('$20.00 + $12.10 shipping'), 12.1)
  assert.equal(parseShipping('$20.00 Local pickup'), null)
})

test('summarize gives medians of price and total, overall and split by free and paid shipping', () => {
  assert.equal(summarize([]), null)
  assert.deepEqual({ ...summarize([{ price: 10, shipping: 0 }, { price: 30, shipping: 5 }, { price: 20, shipping: 4 }]) },
    { n: 3, price: '20.00', total: '24.00', free: 1, freeTotal: '10.00', paidTotal: '29.50' })
  assert.deepEqual({ ...summarize([{ price: 10, shipping: 0 }, { price: 21, shipping: 0 }]) },
    { n: 2, price: '15.50', total: '15.50', free: 2, freeTotal: '15.50', paidTotal: null })
})

test('parseCount reads the results heading', () => {
  assert.equal(parseCount('1,234 results for lego 6080'), 1234)
  assert.equal(parseCount('1 result for lego 6080'), 1)
  assert.equal(parseCount('10,000+ results for lego'), 10000)
  assert.equal(parseCount('No exact matches found'), 0)
  assert.equal(parseCount('Shop by category'), null)
  assert.equal(parseCount(undefined), null)
})

test('sellThrough is sold over sold plus active', () => {
  assert.equal(sellThrough(142, 231), 38)
  assert.equal(sellThrough(5, 0), 100)
  assert.equal(sellThrough(0, 0), null)
  assert.equal(sellThrough(null, 10), null)
  assert.equal(sellThrough(10, null), null)
})
