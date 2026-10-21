// Runs in the eBay tab. Must be self-contained: executeScript serializes the function.
function readEbay () {
  const val = (id) => document.querySelector(`[data-testid="${id}"]`)?.value.trim() ?? ''
  const pkg = {
    lb: val('input.weight.lbs'),
    oz: val('input.weight.oz'),
    length: val('input.dimensions.length'),
    width: val('input.dimensions.width'),
    height: val('input.dimensions.height'),
    shipZip: val('input.location.to.zip')
  }
  if (!document.querySelector('[data-testid="input.weight.lbs"]')) return { error: "This isn't eBay's shipping calculator." }
  const row = [...document.querySelectorAll('[data-testid="service-result-row"]')]
    .find((tr) => /Ground Advantage/i.test(tr.cells[0]?.textContent))
  const price = row?.querySelector('[data-testid="min-price-number"]')?.textContent.trim()
  if (!price) return { error: 'No USPS Ground Advantage price yet. Click Calculate on eBay first.' }
  return { ...pkg, labelCost: price }
}

// Runs in the Ship Pad tab. Datastar's data-bind picks values up from input events.
function fillShipPad (data) {
  const form = document.getElementById('calc')
  if (!form) return { error: "Open Ship Pad's calculator first." }
  for (const [name, value] of Object.entries(data)) {
    const el = form.querySelector(`[data-bind="${name}"]`)
    if (!el) continue
    el.value = value || (name === 'shipZip' || name === 'labelCost' ? '' : '0')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  if (+data.length || +data.width || +data.height) form.querySelector('details')?.setAttribute('open', '')
  return { ok: true }
}

const $ = (id) => document.getElementById(id)
const say = (text) => { $('status').textContent = text }

async function run (func, args = []) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func, args })
    return result
  } catch (err) {
    return { error: `Can't read this tab (${err.message}).` }
  }
}

function show (data) {
  const rows = data && [
    ['Weight', `${data.lb || 0} lb ${data.oz || 0} oz`],
    ['Box', data.length ? `${data.length} × ${data.width} × ${data.height} in` : '—'],
    ['To ZIP', data.shipZip || '—'],
    ['GA label', `$${data.labelCost}`]
  ]
  $('saved').replaceChildren(...(rows ?? []).flatMap(([k, v]) => {
    const dt = document.createElement('dt')
    const dd = document.createElement('dd')
    dt.textContent = k
    dd.textContent = v
    return [dt, dd]
  }))
}

$('copy').addEventListener('click', async () => {
  const data = await run(readEbay)
  if (data.error) return say(data.error)
  await chrome.storage.local.set({ pkg: data })
  show(data)
  say('Copied. Now open Ship Pad and click Fill.')
})

$('fill').addEventListener('click', async () => {
  const { pkg } = await chrome.storage.local.get('pkg')
  if (!pkg) return say('Copy from eBay first.')
  const res = await run(fillShipPad, [pkg])
  say(res.error ?? 'Filled.')
})

chrome.storage.local.get('pkg').then(({ pkg }) => show(pkg))
