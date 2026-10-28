// The icon opens Ship Pad in the side panel on eBay's calculator, and the popup everywhere else.
// The panel is window-wide (manifest side_panel), so it stays open when you switch to the listing tab:
// eBay's pages keep their width (no reflow jump) and Ship Pad isn't reloaded.
const CALC = 'https://www.ebay.com/shp/calc/'
const LIVE = 'https://ship-pad.darrickdevelops.com/'

// The scripts that run on eBay's pages. They're fetched from Ship Pad on every eBay page load and registered
// as user scripts, so a deploy updates them without reloading the extension. The bundled copies are the fallback.
const SCRIPTS = [
  { id: 'calc', matches: [`${CALC}*`], files: ['ebay.js', 'ebay-content.js'] },
  { id: 'listing', matches: ['https://www.ebay.com/lstng*'], files: ['ebay-listing.js'] },
  { id: 'search', matches: ['https://www.ebay.com/sch/*'], files: ['ebay-search.js'] }
]

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

// Needs "Allow User Scripts" on the extension's details page (Chrome 138+) or Developer mode (older Chrome).
function hasUserScripts () {
  try {
    chrome.userScripts.getScripts()
    return true
  } catch {
    return false
  }
}

// Same choice as the side panel: the dev Ship Pad unless you picked live (or never opened dev).
async function base () {
  const { padUrl, panelSite } = await chrome.storage.local.get(['padUrl', 'panelSite'])
  return panelSite === 'live' || !padUrl ? LIVE : padUrl
}

async function fetchCode () {
  const root = await base()
  const get = (file) => fetch(new URL(`extension/${file}`, root), { cache: 'no-store', credentials: 'include' })
    .then((r) => r.ok ? r.text() : Promise.reject(new Error(`${file}: HTTP ${r.status}`)))
  try {
    return await Promise.all(SCRIPTS.map((s) => Promise.all(s.files.map(get))))
  } catch (err) {
    console.warn(`Ship Pad: couldn't fetch eBay scripts from ${root}`, err)
    return null
  }
}

async function register () {
  if (!hasUserScripts()) {
    // Re-register when SCRIPTS gained an entry since the last install.
    if ((await chrome.scripting.getRegisteredContentScripts()).length === SCRIPTS.length) return
    await chrome.scripting.unregisterContentScripts()
    return chrome.scripting.registerContentScripts(SCRIPTS.map(({ id, matches, files }) => ({ id, matches, js: files })))
  }
  await chrome.scripting.unregisterContentScripts()
  // Every time, not just on re-register: without it the scripts' chrome.runtime.sendMessage is missing.
  await chrome.userScripts.configureWorld({ messaging: true })
  const code = await fetchCode()
  const current = await chrome.userScripts.getScripts()
  // Offline or Ship Pad down: keep what's registered, or start from the bundled copies.
  if (!code && current.length) return
  const next = SCRIPTS.map(({ id, matches, files }, i) => ({
    id, matches, js: code ? code[i].map((c) => ({ code: c })) : files.map((file) => ({ file }))
  }))
  const key = (list) => JSON.stringify(list.map((s) => [s.id, s.js]))
  if (key(current) === key(next)) return
  await chrome.userScripts.unregister()
  await chrome.userScripts.register(next)
}

// One sync at a time; overlapping unregister/register calls fail on duplicate ids.
let queue = Promise.resolve()
const sync = () => { queue = queue.then(register).catch((err) => console.warn('Ship Pad: script sync failed', err)) }

chrome.runtime.onInstalled.addListener(sync)
chrome.runtime.onStartup.addListener(sync)
chrome.storage.onChanged.addListener((changes) => { if (changes.padUrl || changes.panelSite) sync() })

// tab.url is only visible for eBay's pages (host_permissions), so other tabs read as "not eBay".
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  chrome.action.setPopup({ tabId, popup: tab.url?.startsWith(CALC) ? '' : 'popup.html' })
  // shortcut: an update fetched here may land just after this page's scripts run; the next load has it.
  if (info.status === 'loading' && SCRIPTS.some((s) => tab.url?.startsWith(s.matches[0].replace('*', '')))) sync()
})

// From eBay's pages: user scripts message via onUserScriptMessage, the bundled fallback via onMessage.
function onMessage (msg, sender, sendResponse) {
  // The "Open Ship Pad" button. open() needs the click's user gesture, so call it right away.
  if (msg === 'open-panel') chrome.sidePanel.open({ windowId: sender.tab.windowId })
  else if (msg?.pkg) chrome.storage.local.set({ pkg: msg.pkg })
  // Values for Ship Pad's form from the listing editor's → buttons; `at` makes resending the same value fire onChanged.
  else if (msg?.fill) chrome.storage.local.set({ fill: { values: msg.fill, at: Date.now() } })
  else if (msg?.toCalc) {
    toCalc(msg.toCalc).then(sendResponse, (err) => sendResponse({ error: err.message }))
    return true // answers asynchronously
  }
}

// The listing editor's package → eBay's calculator, with Ship Pad's ship-from ZIP. Uses an open calculator tab, or opens one.
async function toCalc (pkg) {
  const { originZip } = await fetch(new URL('settings.json', await base()), { credentials: 'include' })
    .then((r) => r.json()).catch(() => ({}))
  // 01510 when Ship Pad has no ZIP saved (or can't be reached).
  const values = { ...pkg, fromZip: originZip || '01510' }
  const fill = async (tabId) => (await chrome.scripting.executeScript({ target: { tabId }, func: fillCalc, args: [values] }))[0].result
  let [tab] = await chrome.tabs.query({ url: `${CALC}*` })
  if (tab) {
    await chrome.tabs.update(tab.id, { active: true })
    await chrome.windows.update(tab.windowId, { focused: true })
  } else {
    tab = await chrome.tabs.create({ url: `${CALC}rates` })
    await loaded(tab.id)
  }
  const result = await fill(tab.id)
  if (result?.error) throw new Error(result.error)
  return { ok: true }
}

function loaded (tabId) {
  return new Promise((resolve) => {
    const done = (id, info) => {
      if (id !== tabId || info.status !== 'complete') return
      chrome.tabs.onUpdated.removeListener(done)
      resolve()
    }
    chrome.tabs.onUpdated.addListener(done)
  })
}

// Runs in eBay's calculator tab, so it must stay self-contained. Uses the native value setter so eBay's
// framework sees the change as typing. The from-ZIP testid is a guess modeled on input.location.to.zip.
async function fillCalc ({ lb, oz, length, width, height, fromZip }) {
  const $ = (id) => document.querySelector(`[data-testid="${id}"]`)
  // eBay renders the form after load. After Calculate it shows a summary instead; its Edit
  // (<div data-testid="ship-details-summary-edit">Edit</div>) brings the form back, to-ZIP included.
  for (let i = 0; i < 40 && !$('input.weight.lbs'); i++) {
    $('ship-details-summary-edit')?.click()
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  if (!$('input.weight.lbs')) return { error: "eBay's calculator form didn't show up." }
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  const set = (id, value) => {
    const el = $(id)
    if (!el || value == null) return
    setValue.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  set('input.weight.lbs', lb || '0')
  set('input.weight.oz', oz || '0')
  set('input.dimensions.length', length)
  set('input.dimensions.width', width)
  set('input.dimensions.height', height)
  if (fromZip) set('input.location.from.zip', fromZip)
  return { ok: true }
}
chrome.runtime.onMessage.addListener(onMessage)
chrome.runtime.onUserScriptMessage?.addListener(onMessage)
