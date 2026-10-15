import { Router } from 'express'
import { SERVICES, db, getRateSource, getSettings, rateGrid } from '../db/client.js'
import {
  applyRateUpdate, checkIfStale, checkRateUpdates, dismissRateUpdate, toastUpdate
} from '../lib/rate-updates.js'
import { sse } from '../lib/sse.js'
import { render } from '../lib/views.js'

const router = Router()

router.get('/', async (req, res) => {
  const service = SERVICES[req.query.service] ? req.query.service : 'usps_ga'
  const [settings, grid, source] = await Promise.all([getSettings(), rateGrid(service), getRateSource('usps_ga')])
  const worstZone = service === 'ups_ground' ? settings.ups_zone : settings.usps_zone
  const applied = req.query.applied == null ? null : parseInt(req.query.applied, 10) || 0
  res.send(render('rates', {
    title: 'Rates', nav: 'rates', services: SERVICES, service, grid, worstZone, source, applied
  }))
})

// Toast shown on every page (layout data-init) while a USPS update is waiting.
router.get('/updates/toast', async (req, res) => {
  const stream = sse(res)
  const update = await toastUpdate()
  if (update) stream.patchElements(render('partials/toast', { update }))
  stream.end()
  checkIfStale().catch(() => {})
})

router.post('/updates/check', async (req, res) => {
  const stream = sse(res)
  const source = await checkRateUpdates({ force: true })
  stream.patchElements(render('partials/rate-update', { source, checked: true }))
  stream.end()
})

router.post('/updates/dismiss', async (req, res) => {
  await dismissRateUpdate()
  const stream = sse(res)
  stream.patchElements('<div id="toast"></div>')
  stream.end()
})

// Plain form post so it works without JS; redirects back to the table.
router.post('/updates/apply', async (req, res) => {
  const updated = await applyRateUpdate({ overwriteEdits: req.body?.overwrite === '1' })
  res.redirect(303, `/rates?service=usps_ga&applied=${updated}`)
})

router.post('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const price = Math.round(Number(req.body.price) * 100) / 100
  const stream = sse(res)
  if (Number.isFinite(price) && price >= 0) {
    await db.execute({ sql: 'UPDATE rates SET price = ?, edited = 1 WHERE id = ?', args: [price, id] })
  }
  const { rows: [cell] } = await db.execute({ sql: 'SELECT id, max_oz, zone, price, edited FROM rates WHERE id = ?', args: [id] })
  if (cell) stream.patchElements(render('partials/rate-cell', { cell, saved: true }))
  stream.end()
})

export default router
