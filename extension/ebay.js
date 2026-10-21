// Reads eBay's shipping calculator: the inputs while you type, the "Rates based on" summary after Calculate,
// and the USPS Ground Advantage price (labelCost: null until then). Null when this isn't the calculator.
// Shared by ebay-content.js and the popup (via executeScript, so it must stay self-contained).
function readEbay () {
  const val = (id) => document.querySelector(`[data-testid="${id}"]`)?.value.trim() ?? ''
  // After Calculate, eBay swaps the form for a summary: "Size up to 0 lbs 2 oz, 6 x 9 x 1 in" / "Ship from US 01510 to US 60561".
  const summary = document.querySelector('[data-testid="ship-details-summary"]')?.textContent.replace(/\s+/g, ' ') ?? ''
  const w = summary.match(/(\d+) lbs? (\d+(?:\.\d+)?) oz/)
  const d = summary.match(/(\d+(?:\.\d+)?) x (\d+(?:\.\d+)?) x (\d+(?:\.\d+)?) in/)
  const to = summary.match(/ to \w+ (\d{5})/)
  const pkg = w
    ? { lb: w[1], oz: w[2], length: d?.[1] ?? '', width: d?.[2] ?? '', height: d?.[3] ?? '', shipZip: to?.[1] ?? '' }
    : {
        lb: val('input.weight.lbs'),
        oz: val('input.weight.oz'),
        length: val('input.dimensions.length'),
        width: val('input.dimensions.width'),
        height: val('input.dimensions.height'),
        shipZip: val('input.location.to.zip')
      }
  if (!w && !document.querySelector('[data-testid="input.weight.lbs"]')) return null
  const row = [...document.querySelectorAll('[data-testid="service-result-row"]')]
    .find((tr) => /Ground Advantage/i.test(tr.cells[0]?.textContent))
  const price = row?.querySelector('[data-testid="min-price-number"]')?.textContent.trim()
  return { ...pkg, labelCost: price || null }
}
