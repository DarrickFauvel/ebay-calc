// On eBay's search results: a Comps button that turns on Buy It Now + Sold + Completed (and a condition) through the URL,
// and on sold results, the median sold price and total (price + shipping) with a → that sends the total to Ship Pad's Check a price,
// plus a sell-through rate from the sold count against the same search's active count.
// Each sold card gets a Skip button to leave a wrong item, lot or bundle out of the median.

// "$12.99" → 12.99. Null for ranges ("$10.00 to $15.00") and text without a price.
function parseMoney (text = '') {
  if (/\bto\b/i.test(text)) return null
  const m = text.match(/\$\s*([\d,]+(?:\.\d+)?)/)
  return m ? Number(m[1].replace(/,/g, '')) : null
}

// A card's text → its shipping: 0 for free, the amount for "+$5.25 delivery" / "+$5.25 shipping", null when it doesn't say.
function parseShipping (text = '') {
  if (/free (delivery|shipping)/i.test(text)) return 0
  const m = text.match(/\+\s*\$\s*([\d,]+(?:\.\d+)?)\s*(delivery|shipping)/i)
  return m ? Number(m[1].replace(/,/g, '')) : null
}

// The results heading ("1,234 results for x") → 1234. 0 for "No exact matches", null when there's no count.
function parseCount (text = '') {
  if (/no exact matches/i.test(text)) return 0
  const m = text.match(/([\d,]+)\+?\s+results?\b/i)
  return m ? Number(m[1].replace(/,/g, '')) : null
}

// Sold ÷ (sold + active) as a whole percent. Null when a count is missing or there's nothing at all.
function sellThrough (sold, active) {
  if (sold == null || active == null || sold + active === 0) return null
  return Math.round(sold / (sold + active) * 100)
}

// A listing link → its item id. Null when it isn't an /itm/ link.
function itemId (href = '') {
  return href.match(/\/itm\/(?:[^/?#]*\/)?(\d+)/)?.[1] ?? null
}

const median = (nums) => {
  const s = [...nums].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

// items: [{ price, shipping }] with both known. Null when there are none. freeTotal / paidTotal are null when that group is empty.
function summarize (items) {
  if (!items.length) return null
  const totals = (list) => list.length ? median(list.map((i) => i.price + i.shipping)).toFixed(2) : null
  const free = items.filter((i) => i.shipping === 0)
  return {
    n: items.length,
    price: median(items.map((i) => i.price)).toFixed(2),
    total: totals(items),
    free: free.length,
    freeTotal: totals(free),
    paidTotal: totals(items.filter((i) => i.shipping > 0))
  }
}

if (globalThis.document) {
  const FILTERS = ['LH_BIN', 'LH_Sold', 'LH_Complete']
  const CONDITIONS = [['New', '1000'], ['Used', '3000'], ['Parts', '7000']]
  const url = new URL(location.href)
  // Sold = Buy It Now + Sold + Completed; Active = Buy It Now only. Null when comps are off.
  const mode = FILTERS.every((k) => url.searchParams.get(k) === '1') ? 'sold'
    : url.searchParams.get('LH_BIN') === '1' && !url.searchParams.has('LH_Sold') ? 'active' : null
  let condition = url.searchParams.get('LH_ItemCondition')

  const clear = (next) => {
    for (const k of [...FILTERS, 'LH_ItemCondition']) next.searchParams.delete(k)
    return next
  }
  const withComps = (m) => {
    const next = clear(new URL(location.href))
    for (const k of m === 'sold' ? FILTERS : ['LH_BIN']) next.searchParams.set(k, '1')
    if (condition) next.searchParams.set('LH_ItemCondition', condition)
    return next
  }

  // A Ship Pad bar pinned to the bottom. Shadow DOM keeps eBay's CSS out and lets it use media queries.
  const LOGO = '<svg viewBox="0 0 64 64" width="24" height="24" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#1d4ed8"/><path d="M14 24 32 15l18 9v20L32 53 14 44Z" fill="#fff"/><path d="M14 24l18 9 18-9M32 33v20M23 19.5 41 28.5v7" fill="none" stroke="#1d4ed8" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg>'
  const host = document.createElement('div')
  const root = host.attachShadow({ mode: 'open' })
  root.innerHTML = `<style>
    :host { position: fixed; left: 0; right: 0; bottom: 0; z-index: 2147483647 }
    [hidden] { display: none !important }
    .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 16px calc(8px + env(safe-area-inset-bottom)); border-top: 6px solid transparent; color: #a6a6a6; font: 16px/1.3 system-ui, sans-serif; box-shadow: 0 4px 24px rgb(0 0 0 / 0.35);
      /* Hazard-stripe top edge, faint stripes inside. One origin keeps both stripe layers in phase. */
      background: repeating-linear-gradient(-45deg, rgb(245 196 0 / 0.035) 0 10px, transparent 0 20px) padding-box,
        linear-gradient(#262626, #262626) padding-box,
        repeating-linear-gradient(-45deg, #f5c400 0 10px, #1c1c1c 0 20px) border-box;
      background-origin: border-box }
    /* Narrow phones drop the logo so both switches fit on one line. */
    .brand { display: none; align-items: center; gap: 8px; margin-right: auto; color: #f0f0f0; font-weight: 700 }
    .ctx { color: #a6a6a6; font-weight: 600 }
    .mode { margin-left: auto }
    .seg { display: flex; border-radius: 22px; box-shadow: inset 0 0 0 1px #3d3d3d; overflow: hidden }
    button { margin: 0; border: 0; min-height: 44px; padding: 0 12px; border-radius: 22px; background: none; color: #f0f0f0; font: 600 16px/44px system-ui, sans-serif; cursor: pointer; white-space: nowrap }
    .seg button { border-radius: 0; padding: 0 10px }
    [aria-pressed="true"] { background: #f0f0f0; color: #1c1c1c }
    .stats { order: 1; flex-basis: 100%; display: flex; align-items: center; gap: 8px; min-width: 0 }
    .text { flex: 1; min-width: 0 }
    .text b { color: #fff }
    .send { flex: none; width: 44px; padding: 0; background: #f0f0f0; color: #1c1c1c }
    @media (min-width: 30rem) { .brand { display: flex } }
    @media (min-width: 52rem) {
      .brand { margin-right: 8px }
      .stats { order: 0; flex: 1 }
      .text { flex: 0 1 auto }
    }
  </style>
  <div class="bar" role="region" aria-label="Ship Pad comps">
    <div class="brand">${LOGO}<span>Ship Pad <span class="ctx">Comps</span></span></div>
    <div class="stats" hidden><span class="text" aria-live="polite"></span><button type="button" class="send">→</button></div>
    <div class="seg mode" role="group" aria-label="Comps">${['Sold', 'Active'].map((name) => `<button type="button" data-mode="${name.toLowerCase()}" aria-pressed="${mode === name.toLowerCase()}">${name}</button>`).join('')}</div>
    <div class="seg cond" role="group" aria-label="Condition">${CONDITIONS.map(([name, code]) => `<button type="button" data-code="${code}">${name}</button>`).join('')}</div>
  </div>`
  const $ = (sel) => root.querySelector(sel)

  // Condition chips: one at a time, tap again for any condition. With comps on, a change reloads right away.
  const chips = [...root.querySelectorAll('.cond button')]
  const paint = () => { for (const b of chips) b.setAttribute('aria-pressed', String(condition === b.dataset.code)) }
  for (const b of chips) {
    b.addEventListener('click', () => {
      condition = condition === b.dataset.code ? null : b.dataset.code
      if (mode) return location.assign(withComps(mode))
      paint()
    })
  }
  paint()

  // Sold | Active: tap the pressed one to turn comps off.
  for (const b of root.querySelectorAll('.mode button')) {
    b.title = b.dataset.mode === 'sold' ? 'Sold Buy It Now listings' : 'Buy It Now listings for sale now'
    b.addEventListener('click', () => location.assign(mode === b.dataset.mode ? clear(new URL(location.href)) : withComps(b.dataset.mode)))
  }

  const stats = $('.stats')
  const text = $('.text')
  const send = $('.send')
  send.title = send.ariaLabel = 'Send median total to Ship Pad'
  let summary = null
  let shown = null
  send.addEventListener('click', async () => {
    if (!summary) return
    let res
    try {
      res = await chrome.runtime.sendMessage({ fill: { mode: 'price', listPrice: summary.total } })
    } catch (err) {
      res = { error: err.message }
    }
    if (res?.error) console.warn('Ship Pad: send failed', res.error)
    send.textContent = res?.error ? '!' : '✓'
    send.title = res?.error ? `Couldn't send: ${res.error}` : send.ariaLabel
    setTimeout(() => { send.textContent = '→' }, 1200)
  })
  document.body.append(host)
  // Room at the bottom of the page so the bar never hides the last results or the page links.
  new ResizeObserver(() => { document.body.style.paddingBottom = `${host.offsetHeight}px` }).observe(host)

  // Cards the seller marked as not a real comp (wrong item, lot, bundle). Kept until reload.
  // shortcut: skips aren't saved across pages or reloads; persist them in sessionStorage if that turns out to matter.
  const skipped = new Set()
  function addSkip (li, id) {
    if (li.querySelector('.shippad-skip')) return
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'shippad-skip', textContent: '✕ Skip', title: 'Leave this sale out of the Ship Pad median' })
    b.style.cssText = 'position:absolute;top:4px;right:4px;z-index:2;min-height:44px;padding:0 12px;border:0;border-radius:22px;background:#262626;color:#f0f0f0;font:600 14px/44px system-ui,sans-serif;cursor:pointer'
    if (getComputedStyle(li).position === 'static') li.style.position = 'relative'
    b.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const on = !skipped.delete(id)
      if (on) skipped.add(id)
      b.setAttribute('aria-pressed', String(on))
      b.textContent = on ? '↺ Use' : '✕ Skip'
      li.style.opacity = on ? '0.35' : ''
      refresh()
    })
    b.setAttribute('aria-pressed', 'false')
    li.append(b)
  }

  // eBay is moving result cards from .s-item to .s-card; take both. Struck-through prices are best offers
  // accepted (the real sold price is hidden), so those cards are skipped.
  function readCards () {
    // Results after "Results matching fewer words" aren't comps.
    const cut = document.querySelector('.srp-river-answer--REWRITE_START')
    const struck = 's, del, [class*="strikethrough" i]'
    return [...document.querySelectorAll('li.s-item, li.s-card')]
      .filter((li) => !cut || cut.compareDocumentPosition(li) & Node.DOCUMENT_POSITION_PRECEDING)
      .filter((li) => !/shop on ebay/i.test(li.textContent))
      .map((li) => {
        const el = [...li.querySelectorAll('[class*="__price"]')].find((e) => !e.closest(struck) && !e.querySelector(struck))
        return { li, id: itemId(li.querySelector('a[href*="/itm/"]')?.href), price: parseMoney(el?.textContent), shipping: parseShipping(li.textContent.replace(/\s+/g, ' ')) }
      })
      .filter((i) => i.price != null && i.shipping != null)
      .filter((i) => {
        if (i.id) addSkip(i.li, i.id)
        return !skipped.has(i.id)
      })
      .map(({ price, shipping }) => ({ price, shipping }))
  }

  const COUNT = '.srp-controls__count-heading, [class*="count-heading"]'
  const readCount = (doc) => parseCount(doc.querySelector(COUNT)?.textContent)

  // The same search without Sold + Completed is what's still for sale. Fetched once; on failure STR just isn't shown.
  let active = null
  if (url.searchParams.get('LH_Sold') === '1') {
    const live = new URL(url)
    live.searchParams.delete('LH_Sold')
    live.searchParams.delete('LH_Complete')
    fetch(live, { credentials: 'include' })
      .then((r) => r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((html) => { active = readCount(new DOMParser().parseFromString(html, 'text/html')); refresh() })
      .catch((err) => console.warn('Ship Pad: active count failed', err.message))
  }

  function refresh () {
    if (url.searchParams.get('LH_Sold') !== '1') return
    summary = summarize(readCards())
    const sold = readCount(document)
    const str = sellThrough(sold, active)
    const key = JSON.stringify([summary, sold, active, skipped.size])
    if (key !== shown) {
      shown = key
      const total = summary && Object.assign(document.createElement('b'), { textContent: `Total $${summary.total}` })
      const parts = summary ? [`Median $${summary.price}`, total] : ['No sold prices found']
      if (summary?.freeTotal) parts.push(`Free ship $${summary.freeTotal} (${summary.free})`)
      if (summary?.paidTotal) parts.push(`Paid ship $${summary.paidTotal} (${summary.n - summary.free})`)
      if (str != null) parts.push(`STR ${str}%`)
      if (skipped.size) parts.push(`${skipped.size} skipped`)
      text.replaceChildren(...parts.flatMap((p, i) => i ? [' · ', p] : [p]))
      text.title = str == null ? '' : `${sold} sold / ${active} active (90 days)`
    }
    stats.hidden = false
    send.hidden = !summary
  }
  let queued = false
  new MutationObserver(() => {
    if (queued) return
    queued = true
    setTimeout(() => { queued = false; refresh() }, 250)
  }).observe(document.body, { childList: true, subtree: true })
  refresh()
}
