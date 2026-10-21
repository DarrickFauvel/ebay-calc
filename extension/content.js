// On Ship Pad: show what's been captured from eBay, and fill it in when you come back to this tab.
const box = document.getElementById('ebay-sync')
const text = document.getElementById('ebay-sync-text')
const button = document.getElementById('fill-from-ebay')
let pkg = null

const filledAt = () => { try { return Number(sessionStorage.getItem('ebayFilledAt')) || 0 } catch { return 0 } }
const markFilled = (at) => { try { sessionStorage.setItem('ebayFilledAt', String(at)) } catch {} }

function render (prefix = 'From eBay') {
  if (!pkg) {
    text.textContent = 'From eBay: nothing yet. Open the eBay calculator and enter the package.'
    button.disabled = true
    return
  }
  const parts = [`${pkg.lb || 0} lb ${pkg.oz || 0} oz`]
  if (+pkg.length) parts.push(`${pkg.length}×${pkg.width}×${pkg.height} in`)
  if (pkg.shipZip) parts.push(`to ${pkg.shipZip}`)
  parts.push(pkg.labelCost ? `USPS GA $${pkg.labelCost}` : 'waiting for Calculate…')
  text.textContent = `${prefix}: ${parts.join(' · ')}`
  button.disabled = false
}

function fill () {
  if (!pkg) return
  fillShipPad(pkg)
  markFilled(pkg.at)
  render('Filled')
}

// Coming back to Ship Pad after eBay calculated: fill in the new price once.
function autoFill () {
  if (document.visibilityState === 'visible' && pkg?.labelCost && pkg.at > filledAt()) fill()
}

if (box) {
  box.hidden = false
  // Remember the dev Ship Pad's address (localhost or Codespaces) for the side panel's Dev/Live switch.
  if (window === top && location.hostname !== 'ship-pad.darrickdevelops.com') chrome.storage.local.set({ padUrl: location.origin + '/' })
  button.addEventListener('click', fill)
  chrome.storage.onChanged.addListener((changes) => {
    if (!changes.pkg) return
    pkg = changes.pkg.newValue ?? null
    render()
    if (document.hasFocus()) autoFill()
  })
  addEventListener('focus', autoFill)
  document.addEventListener('visibilitychange', autoFill)
  chrome.storage.local.get('pkg').then((s) => {
    pkg = s.pkg ?? null
    render()
  })
}
