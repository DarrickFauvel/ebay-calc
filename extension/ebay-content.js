// On eBay's calculator: save what's entered as you type, and the price once results appear.
let timer
let last = ''

function capture () {
  clearTimeout(timer)
  timer = setTimeout(() => {
    const data = readEbay()
    const key = JSON.stringify(data)
    if (!data || key === last) return
    last = key
    // Runs as a user script, which can't use chrome.storage, so background.js saves it.
    chrome.runtime.sendMessage({ pkg: { ...data, at: Date.now() } })
  }, 150)
}

document.addEventListener('input', capture, true)
// Results and the post-Calculate summary are rendered by eBay's app, so watch for them.
new MutationObserver(capture).observe(document.body, { childList: true, subtree: true })
capture()

// A floating button that opens Ship Pad in the side panel. Fixed position so eBay's layout changes can't break it.
const open = document.createElement('button')
open.type = 'button'
open.textContent = 'Open Ship Pad'
open.style.cssText = 'position: fixed; margin: 0; border: 0; right: 16px; bottom: 16px; z-index: 2147483647; min-height: 44px; padding: 0 18px; border-radius: 22px; background: #111; color: #fff; font: 600 16px/44px system-ui, sans-serif; cursor: pointer; box-shadow: 0 2px 8px rgb(0 0 0 / 0.3)'
open.addEventListener('click', () => chrome.runtime.sendMessage('open-panel'))
document.body.append(open)
