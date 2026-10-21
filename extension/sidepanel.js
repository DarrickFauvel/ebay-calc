// Show the dev Ship Pad (last Codespaces/localhost address used) or the live site; the footer switches between them.
const LIVE = 'https://ship-pad.darrickdevelops.com/'
const $ = (id) => document.getElementById(id)

chrome.storage.local.get(['padUrl', 'panelSite']).then(({ padUrl, panelSite }) => {
  const show = (site) => {
    const live = site === 'live' || !padUrl
    const url = live ? LIVE : padUrl
    $('pad').src = url
    $('where').textContent = `${live ? 'Live' : 'Dev'}: ${new URL(url).host}`
    $('where').title = url
    $('swap').textContent = live ? 'Use dev' : 'Use live'
    $('swap').hidden = !padUrl
    $('swap').onclick = () => {
      const next = live ? 'dev' : 'live'
      chrome.storage.local.set({ panelSite: next })
      show(next)
    }
  }
  show(panelSite)
})
