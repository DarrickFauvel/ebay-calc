// Show the dev Ship Pad (last Codespaces/localhost address used) or the live site; the footer switches between them.
const LIVE = 'https://ship-pad.darrickdevelops.com/'
const $ = (id) => document.getElementById(id)
const VERSION = chrome.runtime.getManifest().version

// The Ship Pad shown serves this folder at /extension/, so its manifest is the latest version.
async function checkUpdate (url) {
  $('update').hidden = true
  const latest = await fetch(new URL('extension/manifest.json', url), { cache: 'no-store', credentials: 'include' })
    .then((r) => r.json()).then((m) => m.version).catch(() => null)
  // numeric: 0.4.10 sorts after 0.4.9. Only newer counts, so live doesn't nag a dev build that's ahead.
  if (!latest || latest.localeCompare(VERSION, undefined, { numeric: true }) <= 0) return
  $('update').textContent = `Update to v${latest}`
  $('update').href = new URL('extension.zip', url)
  $('update').hidden = false
}

chrome.storage.local.get(['padUrl', 'panelSite']).then(({ padUrl, panelSite }) => {
  const show = (site) => {
    const live = site === 'live' || !padUrl
    const url = live ? LIVE : padUrl
    $('pad').src = url
    $('where').textContent = `${live ? 'Live' : 'Dev'}: ${new URL(url).host} · v${VERSION}`
    $('where').title = url
    $('swap').textContent = live ? 'Use dev' : 'Use live'
    $('swap').hidden = !padUrl
    $('swap').onclick = () => {
      const next = live ? 'dev' : 'live'
      chrome.storage.local.set({ panelSite: next })
      show(next)
    }
    checkUpdate(url)
  }
  show(panelSite)
})

// Without the userScripts permission, eBay's pages run the bundled scripts (see background.js).
try { chrome.userScripts.getScripts() } catch { $('no-user-scripts').hidden = false }
