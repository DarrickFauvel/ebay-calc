import { Router } from 'express'
import { getLastInputs, getSettings, listCategories, saveLastInputs } from '../db/client.js'
import { parseInputs, quote } from '../lib/quote.js'
import { sse } from '../lib/sse.js'
import { render } from '../lib/views.js'

const router = Router()

router.get('/', async (req, res) => {
  const [settings, categories, last] = await Promise.all([getSettings(), listCategories(), getLastInputs()])
  const signals = {
    cost: last?.cost ?? 5,
    lb: last?.lb ?? 0,
    oz: last?.oz ?? 12,
    length: last?.length ?? 0,
    width: last?.width ?? 0,
    height: last?.height ?? 0,
    categoryId: settings.category_id ?? categories[0]?.id,
    taxPct: settings.tax_pct,
    mode: 'profit',
    targetProfit: last?.target_profit ?? 10,
    listPrice: 0,
    shipZip: '',
    taxZip: ''
  }
  const q = await quote(signals, settings)
  res.send(render('index', { title: 'Calculator', nav: 'calc', settings, categories, signals, q }))
})

router.post('/calc', async (req, res) => {
  const settings = await getSettings()
  const [q] = await Promise.all([quote(req.body, settings), remember(req.body)])
  const stream = sse(res)
  stream.patchElements(render('partials/results', { q, settings }))
  stream.patchElements(render('partials/peek', { q }))
  // Seed the "list price" box with the solved price when switching modes.
  if (q.result && q.input.mode === 'profit') stream.patchSignals({ listPrice: q.result.price })
  if (q.taxFill) stream.patchSignals(q.taxFill)
  stream.patchElements(render('partials/ship-to', { dest: q.dest }))
  stream.end()
})

// Keep the last cost, target profit, weight and box size so the next visit starts from them.
function remember (signals = {}) {
  const { cost, targetProfit, length, width, height } = parseInputs(signals)
  const lb = Math.max(0, Math.floor(Number(signals.lb) || 0))
  const oz = Math.max(0, Number(signals.oz) || 0)
  return saveLastInputs({ cost, targetProfit, lb, oz, length, width, height })
}

export default router
