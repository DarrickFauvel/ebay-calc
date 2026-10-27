import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

// The extension script isn't a module; run it without a document and pull out its pure helpers.
const code = await readFile(new URL('../extension/ebay-listing.js', import.meta.url), 'utf8')
const { parseListing, specificRows, skuCost } = vm.runInNewContext(`${code}\n;({ parseListing, specificRows, skuCost })`)

test('parseListing reads the JSON out of a Claude reply', () => {
  const reply = 'Notes: tag is missing.\n\n```json\n{ "title": "Nike Air Max 90", "sku": "A12-500-261027-1432" }\n```\n'
  assert.equal(parseListing(reply).title, 'Nike Air Max 90')
  assert.equal(parseListing('{"title":"Mug"}').title, 'Mug')
  assert.equal(parseListing('no json here'), null)
  assert.equal(parseListing('{ broken'), null)
  assert.equal(parseListing('[1, 2]'), null)
  assert.equal(parseListing(''), null)
})

test('specificRows flattens arrays and drops empty values', () => {
  // JSON round-trip: arrays from the vm's realm fail deepEqual against ours.
  assert.deepEqual(JSON.parse(JSON.stringify(specificRows({ Brand: 'Nike', Color: ['Red', 'White'], Model: '', Size: null }))),
    [['Brand', 'Nike'], ['Color', 'Red, White']])
  assert.equal(specificRows(undefined).length, 0)
})

test('skuCost reads the cost from a pasted SKU', () => {
  assert.equal(skuCost('A12-500-261027-1432'), '5.00')
})
