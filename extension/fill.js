// Fills Ship Pad's calculator. Shared by the popup (via executeScript) and content.js; Datastar's data-bind picks values up from input events.
function fillShipPad (data) {
  const form = document.getElementById('calc')
  if (!form) return { error: "Open Ship Pad's calculator first." }
  for (const [name, value] of Object.entries(data)) {
    const el = form.querySelector(`[data-bind="${name}"]`)
    if (!el) continue
    // Radios (mode) share a data-bind; check the one with this value.
    if (el.type === 'radio') {
      const radio = form.querySelector(`[data-bind="${name}"][value="${value}"]`)
      if (radio && !radio.checked) {
        radio.checked = true
        radio.dispatchEvent(new Event('change', { bubbles: true }))
        radio.dispatchEvent(new Event('input', { bubbles: true }))
      }
      continue
    }
    el.value = value || (name === 'shipZip' || name === 'labelCost' ? '' : '0')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  return { ok: true }
}
