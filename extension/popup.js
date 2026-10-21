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
    ['GA label', data.labelCost ? `$${data.labelCost}` : 'not calculated yet']
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
  if (!data) return say("This isn't eBay's shipping calculator.")
  if (data.error) return say(data.error)
  await chrome.storage.local.set({ pkg: { ...data, at: Date.now() } })
  show(data)
  say(data.labelCost ? 'Copied. Switch to Ship Pad to fill it in.' : 'Copied the package. Click Calculate on eBay for the price.')
})

$('fill').addEventListener('click', async () => {
  const { pkg } = await chrome.storage.local.get('pkg')
  if (!pkg) return say('Copy from eBay first.')
  const res = await run(fillShipPad, [pkg])
  say(res.error ?? 'Filled.')
})

// Clicking the icon does the obvious thing for the tab: copy on eBay, fill on Ship Pad.
chrome.storage.local.get('pkg').then(async ({ pkg }) => {
  show(pkg)
  const page = await run(() => document.querySelector('[data-testid="shipping-details"]') ? 'ebay' : document.getElementById('calc') ? 'shippad' : null)
  if (page === 'ebay') $('copy').click()
  else if (page === 'shippad') $('fill').click()
  else say("Open eBay's shipping calculator or Ship Pad.")
})
