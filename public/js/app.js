import './components/money-bar.js'
import './components/copy-text.js'
import './components/install-button.js'
import './components/qr-button.js'

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('SW registration failed', err))
}

const banner = document.querySelector('.offline-banner')
const syncOnline = () => { if (banner) banner.hidden = navigator.onLine }
addEventListener('online', syncOnline)
addEventListener('offline', syncOnline)
syncOnline()

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
