// On eBay's search results: a Comps button that turns on Buy It Now + Sold + Completed (and a condition) through the URL,
// and on sold results, the median sold price and total (price + shipping) with a → that sends the total to Ship Pad's Check a price.

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

const median = (nums) => {
  const s = [...nums].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

// items: [{ price, shipping }] with both known. Null when there are none.
function summarize (items) {
  if (!items.length) return null
  return {
    n: items.length,
    price: median(items.map((i) => i.price)).toFixed(2),
    total: median(items.map((i) => i.price + i.shipping)).toFixed(2),
    free: items.filter((i) => i.shipping === 0).length
  }
}

if (globalThis.document) {
  const FILTERS = ['LH_BIN', 'LH_Sold', 'LH_Complete']
  const CONDITIONS = [['New', '1000'], ['Used', '3000'], ['Parts', '7000']]
  const url = new URL(location.href)
  const on = FILTERS.every((k) => url.searchParams.get(k) === '1')
  let condition = url.searchParams.get('LH_ItemCondition')

  const clear = (next) => {
    for (const k of [...FILTERS, 'LH_ItemCondition']) next.searchParams.delete(k)
    return next
  }
  const withComps = () => {
    const next = clear(new URL(location.href))
    for (const k of FILTERS) next.searchParams.set(k, '1')
    if (condition) next.searchParams.set('LH_ItemCondition', condition)
    return next
  }

  const BUTTON = 'margin: 0; border: 0; min-height: 44px; padding: 0 16px; border-radius: 22px; background: #111; color: #fff; font: 600 16px/44px system-ui, sans-serif; cursor: pointer; box-shadow: 0 2px 8px rgb(0 0 0 / 0.3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis'
  const button = (text, style = '') => {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = text
    b.style.cssText = BUTTON + style
    return b
  }
  const bar = document.createElement('div')
  bar.style.cssText = 'position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; max-width: 22rem'
  const row = () => {
    const r = document.createElement('div')
    r.style.cssText = 'display: flex; gap: 6px; max-width: 100%'
    bar.append(r)
    return r
  }

  // Condition chips: one at a time, tap again for any condition. With Comps on, a change reloads right away.
  const chips = CONDITIONS.map(([name, code]) => {
    const b = button(name)
    b.addEventListener('click', () => {
      condition = condition === code ? null : code
      if (on) return location.assign(withComps())
      paint()
    })
    return [b, code]
  })
  const paint = () => {
    for (const [b, code] of chips) {
      b.setAttribute('aria-pressed', String(condition === code))
      b.style.background = condition === code ? '#111' : '#fff'
      b.style.color = condition === code ? '#fff' : '#111'
    }
  }
  row().append(...chips.map(([b]) => b))
  paint()

  const comps = button(on ? 'Comps ✓' : 'Comps')
  comps.title = on ? 'Turn off Buy It Now + Sold filters' : 'Show sold Buy It Now listings'
  comps.addEventListener('click', () => location.assign(on ? clear(new URL(location.href)) : withComps()))
  row().append(comps)

  const statsRow = row()
  const stats = button('', '; cursor: default')
  const send = button('→', '; flex: none; width: 44px; padding: 0')
  send.title = send.ariaLabel = 'Send median total to Ship Pad'
  statsRow.append(stats, send)
  statsRow.style.display = 'none'
  let summary = null
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
  document.body.append(bar)

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
        return { price: parseMoney(el?.textContent), shipping: parseShipping(li.textContent.replace(/\s+/g, ' ')) }
      })
      .filter((i) => i.price != null && i.shipping != null)
  }

  function refresh () {
    if (url.searchParams.get('LH_Sold') !== '1') return
    summary = summarize(readCards())
    const text = summary ? `Sold median $${summary.price} · total $${summary.total} · ${summary.free}/${summary.n} free ship` : 'No sold prices found'
    if (stats.textContent !== text) stats.textContent = stats.title = text
    statsRow.style.display = ''
    send.style.display = summary ? '' : 'none'
  }
  let queued = false
  new MutationObserver(() => {
    if (queued) return
    queued = true
    setTimeout(() => { queued = false; refresh() }, 250)
  }).observe(document.body, { childList: true, subtree: true })
  refresh()
}
