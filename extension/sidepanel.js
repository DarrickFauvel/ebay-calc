// Open whichever Ship Pad was used last (live site, localhost or a Codespaces address).
chrome.storage.local.get('padUrl').then(({ padUrl }) => {
  document.getElementById('pad').src = padUrl ?? 'https://ship-pad.darrickdevelops.com/'
})
