// Glue between the DB (rates, settings, categories) and the pure fee math.
import { SERVICES, getCategory, listCategories, ratesForZone } from '../db/client.js'
import { USPS_DIM, billableOz, calculate, discountRate, lookupRate } from './fees.js'
import { stateForZip } from './states.js'
import { fetchZoneChart, zoneForZip } from './zones.js'

const num = (v, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

/** Normalize the Datastar signals posted by the calculator form. */
export function parseInputs (s = {}) {
  return {
    cost: Math.max(0, num(s.cost)),
    weightOz: Math.max(0, num(s.lb) * 16 + num(s.oz)),
    length: Math.max(0, num(s.length)),
    width: Math.max(0, num(s.width)),
    height: Math.max(0, num(s.height)),
    categoryId: num(s.categoryId, null),
    taxPct: Math.max(0, num(s.taxPct)),
    mode: s.mode === 'price' ? 'price' : 'profit',
    targetProfit: num(s.targetProfit),
    listPrice: Math.max(0, num(s.listPrice)),
    labelCost: Math.max(0, num(s.labelCost)),
    mediaCost: Math.max(0, num(s.mediaCost)),
    shipZip: String(s.shipZip ?? '').replace(/\D/g, '').slice(0, 5),
    taxZip: String(s.taxZip ?? ''),
    media: s.media === true || s.media === 'true'
  }
}

/**
 * Optional "ship to" ZIP: look up its USPS zone from the origin's zone chart.
 * Returns null when no complete ZIP is entered.
 */
export async function destination (zip, settings) {
  if (zip.length !== 5) return null
  const dest = { zip, ...(stateForZip(zip) ?? { state: null, taxPct: null }) }
  if (!settings.origin_zip) return { ...dest, error: 'Set your ZIP (where you ship from) in Settings to look up the zone.' }
  try {
    const zone = zoneForZip(await fetchZoneChart(settings.origin_zip), zip)
    return zone ? { ...dest, zone } : { ...dest, error: 'USPS has no zone for that ZIP.' }
  } catch (err) {
    return { ...dest, error: `Zone lookup failed: ${err.message}` }
  }
}

/**
 * When the ship-to ZIP changes, fill in that state's base tax rate (and restore the
 * default when it's cleared). taxZip remembers which ZIP the rate was filled for,
 * so a rate typed by hand isn't overwritten on the next keystroke.
 */
export function fillTax (input, dest, settings) {
  if (dest?.state && input.shipZip !== input.taxZip) return { taxPct: dest.taxPct, taxZip: input.shipZip }
  if (!input.shipZip && input.taxZip) return { taxPct: settings.tax_pct, taxZip: '' }
  return null
}

/** Worst-zone shipping cost for every service, cheapest first. */
export async function shippingQuotes (pkg, settings, { uspsZone } = {}) {
  const keys = Object.keys(SERVICES).filter((key) => key !== 'usps_media' || pkg.media)
  const quotes = await Promise.all(keys.map(async (key) => {
    const svc = SERVICES[key]
    const isUps = key === 'ups_ground'
    const isMedia = key === 'usps_media'
    const zone = isMedia ? null : isUps ? settings.ups_zone : (uspsZone ?? settings.usps_zone)
    const dim = isMedia ? {} : isUps ? { divisor: settings.ups_dim_divisor } : USPS_DIM
    // UPS applies dim weight to every box, so its price is unreliable without dimensions.
    const needsDims = isUps && !(pkg.length && pkg.width && pkg.height)
    let oz = billableOz(pkg, dim)
    if (isUps && oz > 0) oz = Math.max(oz, 16) // UPS bills a 1 lb minimum
    let rate = lookupRate(await ratesForZone(key, zone ?? 1), oz)
    if (key === 'usps_ga') rate = discountRate(rate, settings.usps_discount_pct)
    // Label costs copied from eBay are the real Ground Advantage and Media Mail prices for this package.
    const ebayCost = isMedia ? pkg.mediaCost : key === 'usps_ga' ? pkg.labelCost : 0
    const ebay = ebayCost > 0
    return {
      key,
      name: svc.name,
      zone,
      billableOz: oz,
      dimApplied: oz > pkg.weightOz && !(isUps && oz === 16),
      price: ebay ? ebayCost : rate?.price ?? null,
      ebay,
      estimate: isUps && rate && !rate.edited,
      worstZone: !ebay && !isMedia && (isUps || uspsZone == null),
      needsDims
    }
  }))
  return quotes.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
}

/**
 * An eBay label cost wins, unless Media Mail (one exact national price) is cheaper. Otherwise the cheapest service we can trust: skip UPS without box dimensions and, with a ship-to
 * ZIP, worst-zone estimates. Falls back to any priced service.
 */
export function pickBest (services, { uspsZone } = {}) {
  const priced = services.filter((s) => s.price != null)
  if (priced.some((s) => s.ebay)) {
    return priced.filter((s) => s.ebay || s.key === 'usps_media').reduce((a, b) => b.price < a.price ? b : a)
  }
  return priced.find((s) => !s.needsDims && !(uspsZone && s.worstZone)) ?? priced[0] ?? null
}

export async function quote (signals, settings) {
  const input = parseInputs(signals)
  const dest = await destination(input.shipZip, settings)
  const taxFill = fillTax(input, dest, settings)
  if (taxFill) input.taxPct = taxFill.taxPct
  const category = (input.categoryId && await getCategory(input.categoryId)) ?? (await listCategories())[0]
  if (input.weightOz <= 0) return { input, dest, taxFill, category, error: 'Enter the packed weight to see shipping.' }

  const uspsZone = dest?.zone
  const services = await shippingQuotes(input, settings, { uspsZone })
  const best = pickBest(services, { uspsZone })
  if (!best) return { input, dest, taxFill, category, services, error: 'Too heavy for the rate tables (70 lb max).' }

  const result = calculate({ ...input, shipping: best.price, category })
  // For a ship-to comparison, also show what the worst-zone label would have been.
  const worst = uspsZone && !best.ebay ? pickBest(await shippingQuotes(input, settings)) : null
  return { input, dest, taxFill, category, services, best, result, worst }
}
