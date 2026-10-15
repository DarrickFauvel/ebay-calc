// Pure pricing math. No I/O — everything here is unit tested.

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

/** Next "charm" price ending in .99 at or above n. */
export const charmPrice = (n) => {
  const floor = Math.floor(n)
  return n <= floor + 0.99 ? floor + 0.99 : floor + 1.99
}

// USPS Ground Advantage: dim weight only for parcels over 1 cubic foot.
export const USPS_DIM = { divisor: 166, minCubicIn: 1728 }

/**
 * Billable weight in ounces: the greater of actual and dimensional weight.
 * Dim weight is rounded up to the next whole pound, as carriers do.
 */
export function billableOz ({ weightOz, length = 0, width = 0, height = 0 }, { divisor, minCubicIn = 0 } = {}) {
  const actual = Math.max(0, weightOz)
  const cubicIn = Math.ceil(length) * Math.ceil(width) * Math.ceil(height)
  if (!divisor || cubicIn <= minCubicIn) return actual
  const dimOz = Math.ceil(cubicIn / divisor) * 16
  return Math.max(actual, dimOz)
}

/**
 * Pick the rate for a weight from a list of { max_oz, price } rows (one zone).
 * Returns null when the parcel is heavier than the table covers.
 */
export function lookupRate (rows, oz) {
  if (oz <= 0) return null
  const sorted = [...rows].sort((a, b) => a.max_oz - b.max_oz)
  return sorted.find((r) => oz <= r.max_oz) ?? null
}

/** Final value fee on an amount, with an optional lower rate above a threshold. */
export function finalValueFee (amount, { fvf_pct, tier_threshold, tier_pct }) {
  const rate = fvf_pct / 100
  if (!tier_threshold || amount <= tier_threshold) return amount * rate
  return tier_threshold * rate + (amount - tier_threshold) * ((tier_pct ?? fvf_pct) / 100)
}

/**
 * Everything that happens to a sale at a given list price (shipping is free,
 * so the buyer pays price + sales tax and eBay charges fees on that total).
 */
export function breakdown ({ price, cost = 0, shipping = 0, taxPct = 0, category }) {
  const salesTax = round2(price * (taxPct / 100)) // tax is charged to the cent
  const orderTotal = price + salesTax
  const fvf = finalValueFee(orderTotal, category)
  const perOrder = category.no_per_order ? 0 : orderTotal > 10 ? 0.4 : 0.3
  const fees = fvf + perOrder
  const payout = price - fees
  const profit = payout - shipping - cost
  return {
    price,
    salesTax,
    orderTotal,
    fvf,
    perOrder,
    fees,
    payout,
    shipping,
    cost,
    profit,
    margin: price > 0 ? profit / price : 0,
    effectiveFeePct: price > 0 ? fees / price : 0
  }
}

/**
 * Lowest list price (to the cent) that yields at least `targetProfit`.
 * Profit rises with price (fee rates < 100%), so bisection lands on the answer
 * even across the per-order-fee and FVF tier thresholds.
 */
export function solvePrice ({ targetProfit, cost = 0, shipping = 0, taxPct = 0, category }) {
  const profitAt = (price) => breakdown({ price, cost, shipping, taxPct, category }).profit
  let lo = 0
  let hi = Math.max(1, (cost + shipping + targetProfit) * 2 + 1)
  while (profitAt(hi) < targetProfit) hi *= 2
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (profitAt(mid) >= targetProfit) hi = mid
    else lo = mid
  }
  let price = Math.ceil(hi * 100 - 1e-6) / 100
  while (profitAt(price) < targetProfit - 1e-9) price = round2(price + 0.01)
  // Cent-rounded tax makes profit step slightly between cents; make sure no lower cent also works.
  while (price > 0 && profitAt(round2(price - 0.01)) >= targetProfit - 1e-9) price = round2(price - 0.01)
  return price
}

/**
 * Full calculation.
 *  - mode "profit": solve the list price for a target profit
 *  - mode "price":  evaluate a given list price
 * `shipPad` is how much the free shipping adds to the list price once the
 * fees on the shipping itself are included.
 */
export function calculate ({ mode = 'profit', targetProfit = 0, listPrice = 0, cost = 0, shipping = 0, taxPct = 0, category }) {
  const base = { cost, shipping, taxPct, category }
  let price
  if (mode === 'price') {
    price = listPrice
  } else {
    price = solvePrice({ ...base, targetProfit })
  }
  const result = breakdown({ ...base, price })
  const noShipPrice = solvePrice({ ...base, shipping: 0, targetProfit: mode === 'price' ? result.profit : targetProfit })
  return {
    ...result,
    shipPad: Math.max(0, price - noShipPrice),
    charm: mode === 'profit' ? charmPrice(price) : null
  }
}
