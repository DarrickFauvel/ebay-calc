// On eBay's listing editor: buttons that jump to the cost (in the SKU), price and shipping sections and the Revise it button.
// Found by their visible text, since eBay's class names are generated and the form renders late.
// Each target: text patterns tried in order, the value its button shows, and the message → sends to background.js
// (fill: Ship Pad's form by data-bind name; toCalc: eBay's shipping calculator).
// eBay's SKU box is <label class="field__label" for="…">Custom label (SKU)</label>.
const TARGETS = [
  {
    name: 'Cost',
    patterns: [/^custom label/i, /\bsku\b/i, /^item title$/i],
    value: (el) => skuCost(el?.value),
    label: (v) => `Cost $${v}`,
    send: (v) => ({ fill: { cost: v } })
  },
  {
    name: 'Price',
    patterns: [/^(item |buy it now )?price$/i, /^pricing$/i],
    value: (el) => el?.value?.replace(/[^\d.]/g, ''),
    label: (v) => `Price $${v}`,
    // Mode first: List price only applies in "Check a price".
    send: (v) => ({ fill: { mode: 'price', listPrice: v } })
  },
  {
    // eBay's package boxes are named majorWeight (lbs), minorWeight (oz), packageLength, packageWidth, packageDepth.
    name: 'Package',
    selector: 'input[name="majorWeight"]',
    patterns: [],
    value: () => readPackage(),
    label: (p) => `Package ${p.lb || 0} lb ${p.oz || 0} oz${+p.length ? ` · ${+p.length}×${+p.width}×${+p.height}` : ''}`,
    send: (p) => ({ toCalc: p }),
    sendLabel: 'Send package to eBay calculator'
  },
  {
    name: 'Shipping',
    patterns: [/^shipping policy$/i, /^shipping$/i, /^shipping/i],
    value: (el) => {
      const policy = (el?.tagName === 'SELECT' ? el.selectedOptions[0]?.text : el?.value || el?.textContent)?.trim()
      // Fell back to the section heading: no policy to show.
      return policy && !/^shipping/i.test(policy) ? policy : null
    },
    label: (v) => `Shipping: ${v}`
  },
  // Only clickables: a "Revise" heading or menu entry elsewhere on the page would otherwise win.
  // eBay's button: <button _track="-1.CTA.1.listItCallToAction" aria-label="Revise it">Revise it</button>
  { name: 'Revise', selector: 'button[_track*="listItCallToAction"], button[aria-label^="Revise" i]', only: 'button, a, [role="button"], input[type="submit"]', patterns: [/^revise it$/i, /^revise/i, /\brevise\b/i] }
]

// SKU is LOCATION-COST-YYMMDD-HHMM with the cost in cents ("B1-218-260818-1432" → "2.18"). Read from the end in case the location has a hyphen.
function skuCost (sku = '') {
  const cents = sku.trim().split('-').at(-3)
  return /^\d+$/.test(cents ?? '') ? (Number(cents) / 100).toFixed(2) : null
}

function readPackage () {
  const val = (name) => document.querySelector(`input[name="${name}"]`)?.value.trim()
  const p = { lb: val('majorWeight'), oz: val('minorWeight'), length: val('packageLength'), width: val('packageWidth'), height: val('packageDepth') }
  return p.lb === undefined || !Object.values(p).some(Boolean) ? null : p
}

function find (patterns, only, selector) {
  // An exact selector skips the visibility check, which can misjudge eBay's sticky footer.
  const exact = selector && document.querySelector(selector)
  if (exact) return exact
  // Labels come first so a field's own label wins; the length cap skips containers that merely include the text.
  const els = (only ? [...document.querySelectorAll(only)] : [...document.querySelectorAll('label'), ...document.querySelectorAll('h1, h2, h3, h4, h5, legend, [role="heading"], button, span, div, p')])
    // Clickables can hold hidden extra text (loading labels), so the length cap is only for the general search.
    .filter((e) => (only || e.textContent.length < 40) && e.checkVisibility())
  const text = (e) => (e.value && e.matches('input') ? e.value : e.textContent).replace(/\s+/g, ' ').trim()
  for (const re of patterns) {
    const el = els.find((e) => re.test(text(e)))
    // A label's field: its control, or a custom dropdown that names the label (aria-labelledby).
    if (el) return el.control ?? (el.id && document.querySelector(`[aria-labelledby~="${CSS.escape(el.id)}"]`)) ?? el
  }
}

// A Ship Pad bar pinned to the bottom, like the one on search results but with blue stripes. Shadow DOM keeps eBay's CSS out.
const LOGO = '<svg viewBox="0 0 64 64" width="24" height="24" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#1d4ed8"/><path d="M14 24 32 15l18 9v20L32 53 14 44Z" fill="#fff"/><path d="M14 24l18 9 18-9M32 33v20M23 19.5 41 28.5v7" fill="none" stroke="#1d4ed8" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg>'
const host = document.createElement('div')
const root = host.attachShadow({ mode: 'open' })
root.innerHTML = `<style>
  :host { position: fixed; left: 0; right: 0; bottom: 0; z-index: 2147483647 }
  [hidden] { display: none !important }
  .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 16px calc(8px + env(safe-area-inset-bottom)); border-top: 6px solid transparent; color: #a6a6a6; font: 16px/1.3 system-ui, sans-serif; box-shadow: 0 4px 24px rgb(0 0 0 / 0.35);
    /* Blue-stripe top edge (search's is yellow), faint stripes inside. One origin keeps both stripe layers in phase. */
    background: repeating-linear-gradient(-45deg, rgb(59 130 246 / 0.06) 0 10px, transparent 0 20px) padding-box,
      linear-gradient(#262626, #262626) padding-box,
      repeating-linear-gradient(-45deg, #1d4ed8 0 10px, #1c1c1c 0 20px) border-box;
    background-origin: border-box }
  /* Narrow phones drop the logo to leave room for the buttons. */
  .brand { display: none; align-items: center; gap: 8px; margin-right: 8px; color: #f0f0f0; font-weight: 700 }
  .ctx { color: #a6a6a6; font-weight: 600 }
  /* Phones: one row you swipe sideways, so the bar stays one button tall. Wide screens wrap instead. */
  .bar { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none }
  .item { display: flex; flex: none; gap: 4px }
  button { margin: 0; border: 0; min-height: 44px; max-width: 18rem; padding: 0 14px; border-radius: 22px; background: none; color: #f0f0f0; box-shadow: inset 0 0 0 1px #3d3d3d; font: 600 16px/44px system-ui, sans-serif; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
  .send { flex: none; width: 44px; padding: 0; background: #f0f0f0; color: #1c1c1c; box-shadow: none }
  @media (min-width: 30rem) { .brand { display: flex; flex: none } }
  @media (min-width: 52rem) { .bar { flex-wrap: wrap } .item { flex: 0 1 auto; min-width: 0 } }
</style>
<div class="bar" role="region" aria-label="Ship Pad listing"><div class="brand">${LOGO}<span>Ship Pad <span class="ctx">Listing</span></span></div></div>`
const bar = root.querySelector('.bar')

const buttons = TARGETS.map((t) => {
  const row = document.createElement('div')
  row.className = 'item'
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.textContent = t.name
  btn.addEventListener('click', () => {
    const el = find(t.patterns, t.only, t.selector)
    if (!el) {
      btn.textContent = 'Not found'
      return setTimeout(refresh, 1200)
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (el.matches('input, textarea, select, button')) el.focus({ preventScroll: true })
  })
  row.append(btn)

  let sendBtn = null
  if (t.send) {
    sendBtn = document.createElement('button')
    sendBtn.type = 'button'
    sendBtn.className = 'send'
    sendBtn.textContent = '→'
    sendBtn.title = sendBtn.ariaLabel = t.sendLabel ?? `Send ${t.name.toLowerCase()} to Ship Pad`
    sendBtn.hidden = true
    sendBtn.addEventListener('click', async () => {
      const v = t.value(find(t.patterns, t.only, t.selector))
      if (!v) return
      // background.js handles it: fill goes to Ship Pad's content.js (side panel and open tabs), toCalc to eBay's calculator.
      let res
      try {
        res = await chrome.runtime.sendMessage(t.send(v))
      } catch (err) {
        res = { error: err.message }
      }
      if (res?.error) console.warn('Ship Pad: send failed', res.error)
      sendBtn.textContent = res?.error ? '!' : '✓'
      sendBtn.title = res?.error ? `Couldn't send: ${res.error}` : sendBtn.ariaLabel
      setTimeout(() => { sendBtn.textContent = '→' }, 1200)
    })
    row.append(sendBtn)
  }
  bar.append(row)
  return { t, btn, sendBtn }
})
document.body.append(host)

// eBay's listing editor has its own fixed footer (List it / Revise it). Sit just above it, and pad the page so nothing hides behind either.
let footer = null
function place () {
  const lift = footer?.isConnected ? Math.max(0, innerHeight - footer.getBoundingClientRect().top) : 0
  host.style.bottom = `${lift}px`
  document.body.style.paddingBottom = `${host.offsetHeight + lift}px`
}
function findFooter () {
  let el = document.querySelector('button[_track*="listItCallToAction"]')
  while (el && el !== document.body && !/fixed|sticky/.test(getComputedStyle(el).position)) el = el.parentElement
  // Only a footer pinned to the bottom of the window counts.
  const next = el && el !== document.body && el.getBoundingClientRect().bottom >= innerHeight - 1 ? el : null
  if (next !== footer) { footer = next; place() }
}
new ResizeObserver(place).observe(host)
addEventListener('resize', place)
addEventListener('scroll', place, { passive: true })

// Keep the cost, price and policy current as you edit and as eBay renders. Only writes when something changes, so our own updates settle.
function refresh () {
  for (const { t, btn, sendBtn } of buttons) {
    const v = t.value?.(find(t.patterns, t.only, t.selector))
    const text = v ? t.label(v) : t.name
    if (btn.textContent !== text) {
      btn.textContent = text
      btn.title = text
    }
    if (sendBtn) sendBtn.hidden = !v
  }
  findFooter()
}
let queued = false
const schedule = () => {
  if (queued) return
  queued = true
  setTimeout(() => { queued = false; refresh() }, 250)
}
document.addEventListener('input', schedule, true)
document.addEventListener('change', schedule, true)
new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true })
refresh()
