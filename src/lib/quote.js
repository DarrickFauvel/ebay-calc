// Glue between the DB (rates, settings, categories) and the pure fee math.
import { SERVICES, getCategory, listCategories, ratesForZone } from '../db/client.js'
import { USPS_DIM, billableOz, calculate, lookupRate } from './fees.js'

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
    listPrice: Math.max(0, num(s.listPrice))
  }
}

/** Worst-zone shipping cost for every service, cheapest first. */
export async function shippingQuotes (pkg, settings) {
  const quotes = await Promise.all(Object.entries(SERVICES).map(async ([key, svc]) => {
    const isUps = key === 'ups_ground'
    const zone = isUps ? settings.ups_zone : settings.usps_zone
    const dim = isUps ? { divisor: settings.ups_dim_divisor } : USPS_DIM
    let oz = billableOz(pkg, dim)
    if (isUps && oz > 0) oz = Math.max(oz, 16) // UPS bills a 1 lb minimum
    const rate = lookupRate(await ratesForZone(key, zone), oz)
    return {
      key,
      name: svc.name,
      zone,
      billableOz: oz,
      dimApplied: oz > pkg.weightOz && !(isUps && oz === 16),
      price: rate?.price ?? null,
      estimate: isUps && rate && !rate.edited
    }
  }))
  return quotes.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
}

export async function quote (signals, settings) {
  const input = parseInputs(signals)
  const category = (input.categoryId && await getCategory(input.categoryId)) ?? (await listCategories())[0]
  if (input.weightOz <= 0) return { input, category, error: 'Enter the packed weight to see shipping.' }

  const services = await shippingQuotes(input, settings)
  const best = services.find((s) => s.price != null)
  if (!best) return { input, category, services, error: 'Too heavy for the rate tables (70 lb max).' }

  const result = calculate({ ...input, shipping: best.price, category })
  return { input, category, services, best, result }
}
