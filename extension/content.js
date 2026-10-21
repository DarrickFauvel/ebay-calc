// Shows Ship Pad's "Fill from eBay" button and fills the calculator from the last copy.
const button = document.getElementById('fill-from-ebay')

function label (pkg) {
  button.textContent = pkg ? `Fill from eBay ($${pkg.labelCost})` : 'Fill from eBay (copy on eBay first)'
  button.disabled = !pkg
}

if (button) {
  button.hidden = false
  chrome.storage.local.get('pkg').then(({ pkg }) => label(pkg))
  chrome.storage.onChanged.addListener((changes) => { if (changes.pkg) label(changes.pkg.newValue) })
  button.addEventListener('click', async () => {
    const { pkg } = await chrome.storage.local.get('pkg')
    if (pkg) fillShipPad(pkg)
  })
}
