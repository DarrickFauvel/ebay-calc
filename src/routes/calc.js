import { Router } from 'express'
import { getSettings, listCategories } from '../db/client.js'
import { quote } from '../lib/quote.js'
import { sse } from '../lib/sse.js'
import { render } from '../lib/views.js'

const router = Router()

router.get('/', async (req, res) => {
  const [settings, categories] = await Promise.all([getSettings(), listCategories()])
  const signals = {
    cost: 5,
    lb: 0,
    oz: 12,
    length: 0,
    width: 0,
    height: 0,
    categoryId: settings.category_id ?? categories[0]?.id,
    taxPct: settings.tax_pct,
    mode: 'profit',
    targetProfit: 10,
    listPrice: 0
  }
  const q = await quote(signals, settings)
  res.send(render('index', { title: 'Calculator', nav: 'calc', settings, categories, signals, q }))
})

router.post('/calc', async (req, res) => {
  const settings = await getSettings()
  const q = await quote(req.body, settings)
  const stream = sse(res)
  stream.patchElements(render('partials/results', { q, settings }))
  stream.patchElements(render('partials/peek', { q }))
  // Seed the "list price" box with the solved price when switching modes.
  if (q.result && q.input.mode === 'profit') stream.patchSignals({ listPrice: q.result.price })
  stream.end()
})

export default router
