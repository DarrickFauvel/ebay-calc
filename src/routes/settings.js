import { Router } from 'express'
import { getSettings, listCategories, updateSettings } from '../db/client.js'
import { sse } from '../lib/sse.js'
import { render } from '../lib/views.js'
import { fetchUspsMaxZone } from '../lib/zones.js'

const router = Router()

const clampInt = (v, lo, hi, fallback) => {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback
}

const status = (message, kind = 'ok') =>
  render('partials/status', { id: 'settings-status', message, kind })

router.get('/settings', async (req, res) => {
  const [settings, categories] = await Promise.all([getSettings(), listCategories()])
  res.send(render('settings', { title: 'Settings', nav: 'settings', settings, categories }))
})

router.post('/settings', async (req, res) => {
  const b = req.body
  const current = await getSettings()
  const next = {
    origin_zip: String(b.originZip ?? '').replace(/\D/g, '').slice(0, 5),
    usps_zone: clampInt(b.uspsZone, 1, 8, current.usps_zone),
    ups_zone: clampInt(b.upsZone, 2, 8, current.ups_zone),
    ups_dim_divisor: clampInt(b.upsDimDivisor, 100, 400, current.ups_dim_divisor),
    tax_pct: Math.min(20, Math.max(0, Number(b.taxPct) || 0)),
    category_id: clampInt(b.categoryId, 1, Number.MAX_SAFE_INTEGER, current.category_id)
  }

  const stream = sse(res)
  // A new origin ZIP means a new worst zone — look it up automatically.
  if (next.origin_zip.length === 5 && next.origin_zip !== current.origin_zip) {
    try {
      const { zone, effectiveDate } = await fetchUspsMaxZone(next.origin_zip)
      next.usps_zone = zone
      next.zone_checked_at = effectiveDate
      stream.patchSignals({ uspsZone: zone })
    } catch (err) {
      stream.patchElements(status(`Saved, but the USPS zone lookup failed: ${err.message}. Set the zone manually.`, 'warn'))
      await updateSettings(next)
      return stream.end()
    }
  }
  await updateSettings(next)
  stream.patchElements(status(`Saved. Worst lower-48 zones: USPS ${next.usps_zone}, UPS ${next.ups_zone}.`))
  stream.end()
})

router.post('/settings/zone', async (req, res) => {
  const stream = sse(res)
  try {
    const { zone, effectiveDate } = await fetchUspsMaxZone(req.body.originZip ?? '')
    stream.patchSignals({ uspsZone: zone })
    stream.patchElements(status(`Furthest lower-48 USPS zone is ${zone} (chart effective ${effectiveDate}). Save to keep it.`))
  } catch (err) {
    stream.patchElements(status(err.message, 'warn'))
  }
  stream.end()
})

export default router
