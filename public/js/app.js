import './components/money-bar.js'
import './components/copy-text.js'

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('SW registration failed', err))
}

const banner = document.querySelector('.offline-banner')
const syncOnline = () => { if (banner) banner.hidden = navigator.onLine }
addEventListener('online', syncOnline)
addEventListener('offline', syncOnline)
syncOnline()

// Extension update notice. content.js stamps data-extension="<version>" on <html>; installs before
// 0.5.2 don't, but on the calculator they do reveal #ebay-sync, so that counts as an old version.
const update = document.querySelector('.extension-update')
const sync = document.getElementById('ebay-sync')
const syncExtension = () => {
  const installed = document.documentElement.dataset.extension ?? (sync && !sync.hidden ? 'old' : null)
  update.hidden = !installed || installed === update.dataset.version
}
if (update) {
  // content.js runs at document_idle, which may be after this module.
  const observer = new MutationObserver(syncExtension)
  observer.observe(document.documentElement, { attributeFilter: ['data-extension'] })
  if (sync) observer.observe(sync, { attributeFilter: ['hidden'] })
  syncExtension()
}

// Drop leading zeros from number boxes on blur ("014.99" → "14.99", "00.5" → "0.5").
// The input event tells Datastar's data-bind about the new value.
addEventListener('change', ({ target: el }) => {
  if (el.type !== 'number') return
  const trimmed = el.value.replace(/^0+(?=\d)/, '')
  if (trimmed === el.value) return
  el.value = trimmed
  el.dispatchEvent(new Event('input', { bubbles: true }))
})

// Mobile: hide the floating price peek while the full results are on screen.
// State lives on <html> because Datastar re-renders #peek on every calc.
const results = document.getElementById('results')
if (results && 'IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => {
    document.documentElement.toggleAttribute('data-results-visible', entry.isIntersecting)
  }, { threshold: 0.15 }).observe(results)
}

// Flash a value when it changes (a recalc, or a fill from eBay). Tracked by its data-flash
// key rather than the node, since Datastar may morph or replace it.
const seen = new Map()
const flashChanged = () => {
  for (const el of document.querySelectorAll('[data-flash]')) {
    const key = el.dataset.flash
    if (seen.has(key) && seen.get(key) !== el.textContent) {
      el.animate([{ background: 'color-mix(in oklab, var(--good) 35%, transparent)' }, { background: 'transparent' }], { duration: 1200, easing: 'ease-out' })
    }
    seen.set(key, el.textContent)
  }
}
const main = document.querySelector('main')
if (main) new MutationObserver(flashChanged).observe(main, { childList: true, characterData: true, subtree: true })
flashChanged()
