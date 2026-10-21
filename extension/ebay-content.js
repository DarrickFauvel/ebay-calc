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
    chrome.storage.local.set({ pkg: { ...data, at: Date.now() } })
  }, 150)
}

document.addEventListener('input', capture, true)
// Results and the post-Calculate summary are rendered by eBay's app, so watch for them.
new MutationObserver(capture).observe(document.body, { childList: true, subtree: true })
capture()
