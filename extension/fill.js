// Fills Ship Pad's calculator. Shared by the popup (via executeScript) and content.js; Datastar's data-bind picks values up from input events.
function fillShipPad (data) {
  const form = document.getElementById('calc')
  if (!form) return { error: "Open Ship Pad's calculator first." }
  for (const [name, value] of Object.entries(data)) {
    const el = form.querySelector(`[data-bind="${name}"]`)
    if (!el) continue
    el.value = value || (name === 'shipZip' || name === 'labelCost' ? '' : '0')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  if (+data.length || +data.width || +data.height) form.querySelector('details')?.setAttribute('open', '')
  return { ok: true }
}
