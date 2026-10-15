import { Router } from 'express'
import { SERVICES, db, getSettings, rateGrid } from '../db/client.js'
import { sse } from '../lib/sse.js'
import { render } from '../lib/views.js'

const router = Router()

router.get('/', async (req, res) => {
  const service = SERVICES[req.query.service] ? req.query.service : 'usps_ga'
  const [settings, grid] = await Promise.all([getSettings(), rateGrid(service)])
  const worstZone = service === 'ups_ground' ? settings.ups_zone : settings.usps_zone
  res.send(render('rates', {
    title: 'Rates', nav: 'rates', services: SERVICES, service, grid, worstZone
  }))
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
