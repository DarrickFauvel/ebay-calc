// On eBay's listing editor: buttons that jump to the SKU, price and shipping sections and the Revise it button.
// Found by their visible text at click time, since eBay's class names are generated and the form renders late.
// Each target: text patterns tried in order. eBay's SKU box is <label class="field__label" for="…">Custom label (SKU)</label>.
const TARGETS = [
  ['SKU', [/^custom label/i, /\bsku\b/i, /^item title$/i]],
  ['Price', [/^pricing$/i, /^(item |buy it now )?price$/i]],
  ['Shipping', [/^shipping$/i, /^shipping/i]],
  ['Revise', [/^revise it$/i, /^revise( item)?$/i]]
]

function find (patterns) {
  // Labels come first so a field's own label wins; the length cap skips containers that merely include the text.
  const els = [...document.querySelectorAll('label'), ...document.querySelectorAll('h1, h2, h3, h4, h5, legend, [role="heading"], button, span, div, p')]
    .filter((e) => e.textContent.length < 40 && !bar.contains(e) && e.checkVisibility())
  for (const re of patterns) {
    const el = els.find((e) => re.test(e.textContent.replace(/\s+/g, ' ').trim()))
    if (el) return el
  }
}

const bar = document.createElement('div')
bar.style.cssText = 'position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; display: flex; flex-direction: column; gap: 8px'
for (const [name, patterns] of TARGETS) {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.textContent = name
  btn.style.cssText = 'margin: 0; border: 0; min-height: 44px; padding: 0 16px; border-radius: 22px; background: #111; color: #fff; font: 600 16px/44px system-ui, sans-serif; cursor: pointer; box-shadow: 0 2px 8px rgb(0 0 0 / 0.3)'
  btn.addEventListener('click', () => {
    const found = find(patterns)
    const el = found?.control ?? found
    if (!el) {
      btn.textContent = 'Not found'
      return setTimeout(() => { btn.textContent = name }, 1200)
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (el.matches('input, textarea, select, button')) el.focus({ preventScroll: true })
  })
  bar.append(btn)
}
document.body.append(bar)

