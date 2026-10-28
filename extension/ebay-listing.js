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

// Claude's listing JSON (docs/claude-listing-prompt.md), from a reply that may wrap it in ```json fences or notes. Null when there's none.
function parseListing (text = '') {
  try {
    const l = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
    return l && typeof l === 'object' && !Array.isArray(l) ? l : null
  } catch {
    return null
  }
}

// Specifics as [name, value] rows; Claude may give multi-value specifics as arrays.
function specificRows (specifics) {
  if (!specifics || typeof specifics !== 'object') return []
  return Object.entries(specifics)
    .map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : String(v ?? '')])
    .filter(([, v]) => v.trim())
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

// The bar. Skipped without a document so tests can load the helpers above.
if (globalThis.document) {
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
    .primary { background: #f0f0f0; color: #1c1c1c; box-shadow: none }
    /* What Paste listing filled, above the bar: every value with a Copy button for anything to enter by hand. */
    .sheet { max-height: 40vh; overflow-y: auto; padding: 8px 16px; background: #1c1c1c; color: #f0f0f0; font: 16px/1.3 system-ui, sans-serif; box-shadow: 0 -4px 24px rgb(0 0 0 / 0.35) }
    .sheet header { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding-bottom: 8px }
    .sheet h2 { flex: 1; margin: 0; font-size: 16px }
    .sheet a { color: #f0f0f0; font-weight: 600 }
    .row { display: grid; grid-template-columns: 1fr auto; column-gap: 12px; align-items: center; padding: 8px 0; border-top: 1px solid #333 }
    /* Hidden: just the header strip, so the form has room while you work through it. */
    @media (max-width: 79.99rem) {
      .sheet.min .row { display: none }
      .sheet.min header { padding-bottom: 0 }
    }
    /* Full-width windows: a left side panel down to the bar, and place() pads the page so it sits beside the form. */
    @media (min-width: 80rem) {
      .sheet { position: fixed; top: 0; left: 0; bottom: var(--below, 0); width: 22rem; max-height: none; box-sizing: border-box; box-shadow: 4px 0 24px rgb(0 0 0 / 0.35) }
      .sheet .min-btn { display: none }
    }
    .row .k { color: #a6a6a6; font-size: 14px }
    .row .v { overflow: hidden; white-space: nowrap; text-overflow: ellipsis }
    .row > button:not(.go) { grid-column: 2 }
    /* The row's name and value: a plain-looking button that jumps to and fills the eBay field. */
    .row .go { display: grid; min-width: 0; max-width: none; min-height: 44px; padding: 4px 8px; margin: 0 -8px; border-radius: 8px; box-shadow: none; text-align: left; font: inherit; line-height: 1.3; white-space: normal }
    .row .go:hover, .row .go:focus-visible { background: #2a2a2a }
    @media (min-width: 30rem) { .brand { display: flex; flex: none } }
    @media (min-width: 52rem) { .bar { flex-wrap: wrap } .item { flex: 0 1 auto; min-width: 0 } }
  </style>
  <div class="sheet" role="region" aria-label="Pasted listing" hidden></div>
  <div class="bar" role="region" aria-label="Ship Pad listing"><div class="brand">${LOGO}<span>Ship Pad <span class="ctx">Listing</span></span></div></div>`
  const bar = root.querySelector('.bar')
  const sheet = root.querySelector('.sheet')

  // Paste listing: fills the draft from Claude's listing JSON. Item specifics fill when you click their row.
  // Each fill gets the value and the field find() matched for its patterns (the same field a row click scrolls to).
  const FIELDS = [
    { key: 'title', name: 'Title', patterns: [/^item title$/i, /^title$/i], fill: setField },
    { key: 'sku', name: 'Custom label (SKU)', patterns: [/^custom label/i, /\bsku\b/i], fill: setField },
    { key: 'condition', name: 'Condition', patterns: [/^(item )?condition$/i], fill: pickCondition },
    { key: 'conditionNote', name: 'Condition description', patterns: [/^condition description$/i, /^describe .*condition/i], fill: setField },
    { key: 'description', name: 'Description', patterns: [/^(item )?description$/i], fill: setDescription }
  ]
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

  // The native setter makes eBay's framework see the change as typing (same as fillCalc in background.js).
  function setValue (el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  function setField (value, el) {
    if (!el?.matches('input, textarea')) return false
    setValue(el, value)
    return true
  }
  function setSelect (el, value) {
    const opt = [...el.options].find((o) => norm(o.text) === norm(value))
    if (!opt) return false
    el.value = opt.value
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  // The visible clickable whose own text is the value: an option in an open eBay menu, or a radio/button.
  const optionFor = (value) => [...document.querySelectorAll('span, div, label, button, li')]
    .find((e) => e.textContent.length < 80 && norm(e.textContent) === norm(value) && e.checkVisibility())
    ?.closest('[role="option"], [role="radio"], [role="menuitemradio"], [role="menuitemcheckbox"], label, button, li')

  // A <select>, or eBay's custom picker: click the option whose own text is the condition, opening the picker first if needed.
  async function pickCondition (value, field) {
    if (field?.tagName === 'SELECT') return setSelect(field, value)
    let el = optionFor(value)
    if (!el && field) {
      field.click()
      await wait(400)
      el = optionFor(value)
    }
    el?.click()
    return !!el
  }

  // Item specifics: a text box, a <select>, or eBay's dropdown that opens a search box taking custom values.
  // In the dropdown: type each value, then click the matching option or press Enter to add it as your own.
  // shortcut: guessed from eBay's menu pattern (focused search box on open), returns 'check' since it can't confirm; pin to real markup if it misfires.
  async function fillSpecific (values, el) {
    if (!el) return false
    if (el.matches('input, textarea')) return setField(values.join(', '), el)
    if (el.tagName === 'SELECT') return setSelect(el, values[0])
    let ok = false
    for (const v of values) {
      if (el.getAttribute('aria-expanded') !== 'true') el.click()
      await wait(300)
      const box = document.activeElement?.matches('input') ? document.activeElement : null
      if (box) { setValue(box, v); await wait(400) }
      const opt = optionFor(v)
      if (opt) opt.click()
      else if (box) box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }))
      else continue
      ok = 'check'
      await wait(200)
    }
    return ok
  }

  // A plain textarea (HTML mode), or the rich editor: contenteditable on the page or in a same-origin iframe.
  function setDescription (value) {
    const ta = document.querySelector('textarea[name*="description" i]')
    if (ta?.checkVisibility()) {
      setValue(ta, value)
      return true
    }
    const frames = [...document.querySelectorAll('iframe')].map((f) => { try { return f.contentDocument } catch { return null } })
    for (const doc of [document, ...frames].filter(Boolean)) {
      const el = doc.querySelector('[contenteditable="true"]') ?? (doc.designMode === 'on' ? doc.body : null)
      if (!el) continue
      el.focus()
      doc.execCommand('selectAll')
      doc.execCommand('insertText', false, value)
      return true
    }
    return false
  }

  // Clipboard first (Chrome asks once to allow it on eBay); a prompt when that's blocked or holds something else.
  async function pasteListing () {
    let text = ''
    try { text = await navigator.clipboard.readText() } catch {}
    const listing = parseListing(text) ?? parseListing(prompt("Paste the listing JSON from Claude's reply:") ?? '')
    if (!listing) return
    // A row: what the sheet shows, and how a click finds and fills its field again.
    const rows = []
    for (const f of FIELDS) {
      const v = listing[f.key]
      if (!v) continue
      const row = { name: f.name, value: String(v), patterns: f.patterns, fill: (el) => f.fill(String(v), el) }
      row.status = statusText(await apply(row))
      rows.push(row)
    }
    // Specifics wait for a click: each one opens an eBay menu, and doing them all at once would fight over focus.
    for (const [k, v] of specificRows(listing.itemSpecifics)) {
      const raw = listing.itemSpecifics[k]
      const values = (Array.isArray(raw) ? raw : [raw]).map(String).filter((s) => s.trim())
      const re = new RegExp(`^${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
      rows.push({ name: k, value: v, patterns: [re], fill: (el) => fillSpecific(values, el), status: 'Item specific, click to fill' })
    }
    const cost = skuCost(listing.sku)
    if (cost) chrome.runtime.sendMessage({ fill: { cost } }).catch((err) => console.warn('Ship Pad: send failed', err))
    showSheet(rows, listing.compQuery)
  }

  async function apply (row) {
    try { return await row.fill(find(row.patterns)) } catch (err) { console.warn(`Ship Pad: couldn't fill ${row.name}`, err) }
    return false
  }
  const statusText = (ok) => ok === 'check' ? '→ Entered, check it' : ok ? '✓ Filled' : '⚠ Not found, copy it'

  // Built with textContent: the values come from the clipboard.
  function showSheet (rows, compQuery) {
    const head = document.createElement('header')
    const h = document.createElement('h2')
    h.textContent = 'Pasted listing'
    head.append(h)
    if (compQuery) {
      const a = document.createElement('a')
      a.href = `https://www.ebay.com/sch/i.html?${new URLSearchParams({ _nkw: compQuery, LH_Sold: 1, LH_Complete: 1 })}`
      a.target = '_blank'
      a.textContent = `Sold comps: ${compQuery}`
      head.append(a)
    }
    const min = document.createElement('button')
    min.type = 'button'
    min.className = 'min-btn'
    min.textContent = 'Hide'
    min.ariaExpanded = 'true'
    min.addEventListener('click', () => {
      const hide = sheet.classList.toggle('min')
      min.textContent = hide ? 'Show' : 'Hide'
      min.ariaExpanded = String(!hide)
    })
    const close = document.createElement('button')
    close.type = 'button'
    close.textContent = 'Close'
    close.addEventListener('click', () => { sheet.hidden = true; place() })
    head.append(min, close)
    sheet.replaceChildren(head, ...rows.map((r) => {
      const { name, value } = r
      const row = document.createElement('div')
      row.className = 'row'
      // The name and value are one button: scroll to the eBay field and fill it (again).
      const go = document.createElement('button')
      go.type = 'button'
      go.className = 'go'
      go.title = `Go to ${name} and fill it`
      const k = document.createElement('span')
      k.className = 'k'
      k.textContent = `${name} · ${r.status}`
      const v = document.createElement('span')
      v.className = 'v'
      v.textContent = value
      go.append(k, v)
      go.addEventListener('click', async () => {
        const el = find(r.patterns)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        if (el?.matches('input, textarea, select, button')) el.focus({ preventScroll: true })
        k.textContent = `${name} · ${statusText(await apply(r))}`
      })
      const copy = document.createElement('button')
      copy.type = 'button'
      copy.textContent = 'Copy'
      copy.ariaLabel = `Copy ${name}`
      copy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(value)
          copy.textContent = 'Copied'
        } catch {
          copy.textContent = '!'
        }
        setTimeout(() => { copy.textContent = 'Copy' }, 1200)
      })
      row.append(go, copy)
      return row
    }))
    sheet.classList.remove('min')
    sheet.hidden = false
    place()
  }

  const pasteItem = document.createElement('div')
  pasteItem.className = 'item'
  const pasteBtn = document.createElement('button')
  pasteBtn.type = 'button'
  pasteBtn.className = 'primary'
  pasteBtn.textContent = 'Paste listing'
  pasteBtn.addEventListener('click', pasteListing)
  pasteItem.append(pasteBtn)
  bar.append(pasteItem)

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
    host.style.setProperty('--below', `${bar.offsetHeight + lift}px`)
    // The side panel is fixed, so it adds nothing to the host's height: pad the page left instead.
    const side = !sheet.hidden && matchMedia('(min-width: 80rem)').matches
    document.body.style.paddingLeft = side ? `${sheet.offsetWidth}px` : ''
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
}
